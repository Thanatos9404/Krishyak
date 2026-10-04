"""Approved DigiLocker member of MeriPehchaan, with no document APIs.

First link requires the existing phone account and separate identity consent.
Subsequent login can use that verified link. Claims never supply phone identity.
"""

import asyncio
import base64
import hashlib
import json
import logging
import os
import secrets
from urllib.parse import urlencode, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field, SecretStr
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from db.models import Farmer, GovernmentIdentity

from .auth import authenticate, check_origin, issue_session, token_hash
from .router import current_farmer, database, require_consent
from .schemas import Input

BASE = "https://digilocker.meripehchaan.gov.in/public/oauth2"
AUTHORIZE = BASE + "/1/authorize"
TOKEN = BASE + "/2/token"
REVOKE = BASE + "/1/revoke"
# OAuth specification value; this is a token-kind hint, not a credential.
ACCESS_KIND = "access_token"
CALLBACK = "/api/v2/government/auth/callback"
COOKIE = "krishyak_government_flow"
router = APIRouter(prefix="/api/v2/government/auth", tags=["Optional approved government identity"])
LOGGER = logging.getLogger(__name__)


class Configuration(BaseModel):
    enabled: bool = False
    approved: bool = False
    client_id: str = Field(default="", max_length=200)
    client_secret: SecretStr = SecretStr("")
    redirect_uri: str = ""
    issuer: str = ""
    public_key_pem: SecretStr = SecretStr("")

    @classmethod
    def from_env(cls):
        return cls(
            enabled=os.getenv("MERIPEHCHAAN_ENABLED", "false").lower() == "true",
            approved=os.getenv("MERIPEHCHAAN_PARTNER_APPROVED", "false").lower() == "true",
            client_id=os.getenv("MERIPEHCHAAN_CLIENT_ID", ""),
            client_secret=os.getenv("MERIPEHCHAAN_CLIENT_SECRET", ""),
            redirect_uri=os.getenv("MERIPEHCHAAN_REDIRECT_URI", ""),
            issuer=os.getenv("MERIPEHCHAAN_ISSUER", ""),
            public_key_pem=os.getenv("MERIPEHCHAAN_PUBLIC_KEY_PEM", ""),
        )

    def ready(self, settings):
        uri = urlsplit(self.redirect_uri)
        issuer = urlsplit(self.issuer)
        origin = f"{uri.scheme}://{uri.netloc}"
        key = self.public_key_pem.get_secret_value()
        return bool(
            self.enabled
            and self.approved
            and self.client_id
            and self.client_secret.get_secret_value()
            and origin in settings.origins
            and uri.path == CALLBACK
            and not uri.query
            and not uri.fragment
            and not uri.username
            and uri.scheme == "https"
            and issuer.scheme == "https"
            and issuer.hostname
            and not issuer.username
            and not issuer.query
            and not issuer.fragment
            and "-----BEGIN PUBLIC KEY-----" in key
            and "PRIVATE KEY" not in key
        )


class Start(Input):
    mode: str = Field(pattern="^(link|login)$")


class MeriPehchaanAdapter:
    def __init__(self, settings, quotas, configuration=None, client_factory=None):
        self.settings = settings
        self.quotas = quotas
        self.config = configuration or Configuration.from_env()
        self.client_factory = client_factory or httpx.AsyncClient

    def available(self):
        return (
            self.settings.enabled
            and self.config.ready(self.settings)
            and self.quotas is not None
            and self.quotas.redis is not None
        )

    def require_ready(self):
        if not self.available():
            raise HTTPException(503, "Government login is not configured. Use phone sign-in.")

    def begin(self, browser, farmer_id, mode):
        self.require_ready()
        state, nonce, verifier = (secrets.token_urlsafe(32) for _ in range(3))
        record = {
            "browser_hash": token_hash(browser, self.settings),
            "farmer_id": str(farmer_id) if farmer_id else None,
            "mode": mode,
            "nonce": nonce,
            "verifier": verifier,
        }
        try:
            accepted = self.quotas.redis.set(
                "krishyak:government-state:" + token_hash(state, self.settings), json.dumps(record), ex=600, nx=True
            )
        except Exception:
            raise HTTPException(503, "Government login state storage unavailable") from None
        if not accepted:
            raise HTTPException(503, "Government login state storage unavailable")
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        return (
            AUTHORIZE
            + "?"
            + urlencode(
                {
                    "client_id": self.config.client_id,
                    "redirect_uri": self.config.redirect_uri,
                    "response_type": "code",
                    "scope": "openid",
                    "state": state,
                    "nonce": nonce,
                    "code_challenge": challenge,
                    "code_challenge_method": "S256",
                }
            )
        )

    def consume(self, state, browser):
        self.require_ready()
        if not browser or len(browser) > 200:
            raise HTTPException(400, "Government login verification failed")
        try:
            raw = self.quotas.redis.getdel("krishyak:government-state:" + token_hash(state, self.settings))
            if not raw or len(raw) > 4096:
                raise ValueError()
            record = json.loads(raw)
            if not secrets.compare_digest(record["browser_hash"], token_hash(browser, self.settings)):
                raise ValueError()
        except Exception:
            raise HTTPException(400, "Government login expired or verification failed") from None
        return record

    async def exchange(self, code, record):
        self.require_ready()
        token = None
        try:
            async with (
                asyncio.timeout(10),
                self.client_factory(timeout=httpx.Timeout(8, connect=3), follow_redirects=False) as client,
            ):
                async with client.stream(
                    "POST",
                    TOKEN,
                    data={
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": self.config.redirect_uri,
                        "code_verifier": record["verifier"],
                    },
                    auth=(self.config.client_id, self.config.client_secret.get_secret_value()),
                ) as response:
                    if response.status_code != 200 or "json" not in response.headers.get("content-type", ""):
                        raise ValueError()
                    chunks, size = [], 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > 32768:
                            raise ValueError()
                        chunks.append(chunk)
                    payload = json.loads(b"".join(chunks))
                token = payload.get("access_token")
                if (
                    not isinstance(token, str)
                    or not 1 <= len(token) <= 4096
                    or payload.get("token_type") != "Bearer"
                    or payload.get("scope") != "openid"
                ):
                    raise ValueError()
                expiry = payload.get("expires_in")
                if isinstance(expiry, bool) or not isinstance(expiry, int) or not 1 <= expiry <= 86400:
                    raise ValueError()
                import jwt

                claims = jwt.decode(
                    payload["id_token"],
                    self.config.public_key_pem.get_secret_value(),
                    algorithms=["RS256"],
                    audience=self.config.client_id,
                    issuer=self.config.issuer,
                    options={"require": ["exp", "iat", "iss", "sub", "aud", "nonce"], "strict_aud": True},
                )
                if (
                    not isinstance(claims["sub"], str)
                    or not 1 <= len(claims["sub"]) <= 200
                    or not secrets.compare_digest(claims["nonce"], record["nonce"])
                ):
                    raise ValueError()
                # Retain only a keyed digest. No name, birth date, phone, document,
                # demographic or other government claim is copied or trusted.
                return token_hash(self.config.issuer + ":" + claims["sub"], self.settings)
        except Exception:
            raise HTTPException(502, "Government login could not be verified. Use phone sign-in.") from None
        finally:
            # This integration needs no lasting provider access. Revoke and discard
            # the access token, including on invalid claims. Never store it.
            if isinstance(token, str) and 1 <= len(token) <= 4096:
                try:
                    async with (
                        asyncio.timeout(4),
                        self.client_factory(timeout=httpx.Timeout(3, connect=2), follow_redirects=False) as client,
                    ):
                        async with client.stream(
                            "POST",
                            REVOKE,
                            data={"token": token, "token_type_hint": ACCESS_KIND},
                            auth=(self.config.client_id, self.config.client_secret.get_secret_value()),
                        ):
                            pass
                except Exception:
                    LOGGER.warning("government_auth operation=token_revoke status=unavailable")


@router.get("/status")
def status(request: Request):
    adapter = request.app.state.v2_government_auth
    return {
        "available": adapter.available(),
        "provider": "MeriPehchaan / DigiLocker",
        "first_link_requires_phone_sign_in": True,
        "document_access": False,
        "message": "Optional approved government login"
        if adapter.available()
        else "Government login is not configured. Use phone sign-in.",
    }


@router.post("/start")
def start(body: Start, request: Request, response: Response, db=Depends(database, scope="function")):
    check_origin(request)
    adapter = request.app.state.v2_government_auth
    adapter.require_ready()
    request.app.state.v2_quotas.check("government_login", request.client.host if request.client else "unknown", 6, 600)
    farmer = None
    if body.mode == "link":
        farmer, _ = authenticate(db, request)
        require_consent(db, farmer, "government_identity")
    browser = secrets.token_urlsafe(32)
    url = adapter.begin(browser, farmer.id if farmer else None, body.mode)
    response.set_cookie(
        COOKIE, browser, max_age=600, httponly=True, secure=True, samesite="lax", path="/api/v2/government/auth"
    )
    return {"authorization_url": url}


@router.get("/callback")
async def callback(
    request: Request,
    state: str = Query(min_length=20, max_length=200),
    code: str | None = Query(default=None, max_length=2000),
    error: str | None = Query(default=None, max_length=200),
    db=Depends(database, scope="function"),
):
    adapter = request.app.state.v2_government_auth
    record = adapter.consume(state, request.cookies.get(COOKIE, ""))
    origin = adapter.config.redirect_uri.split(CALLBACK)[0]
    response = RedirectResponse(
        origin + "/app/more/settings?government=cancelled"
        if error or not code
        else origin + "/app/more/settings?government=connected",
        status_code=303,
    )
    response.delete_cookie(COOKIE, path="/api/v2/government/auth", secure=True, httponly=True, samesite="lax")
    if error or not code:
        return response
    request.app.state.v2_quotas.check("government_exchange", "global", 60, 3600)
    farmer = None
    if record["mode"] == "link":
        farmer, session = authenticate(db, request)
        if str(farmer.id) != record["farmer_id"]:
            raise HTTPException(403, "Government account link requires the original signed-in account")
        require_consent(db, farmer, "government_identity")
        db.commit()
    subject_hash = await adapter.exchange(code, record)
    existing = db.scalar(
        select(GovernmentIdentity).where(
            GovernmentIdentity.issuer == adapter.config.issuer, GovernmentIdentity.subject_hash == subject_hash
        )
    )
    if record["mode"] == "link":
        farmer, session = authenticate(db, request, lock=True)
        if str(farmer.id) != record["farmer_id"]:
            raise HTTPException(403, "Government account link requires the original signed-in account")
        require_consent(db, farmer, "government_identity")
        if existing and existing.farmer_id != farmer.id:
            raise HTTPException(409, "Government identity is already linked to another account")
        linked = db.scalar(
            select(GovernmentIdentity).where(
                GovernmentIdentity.farmer_id == farmer.id, GovernmentIdentity.issuer == adapter.config.issuer
            )
        )
        if linked and linked.subject_hash != subject_hash:
            raise HTTPException(409, "This account already has a different government identity link")
        if not existing:
            db.add(GovernmentIdentity(farmer_id=farmer.id, issuer=adapter.config.issuer, subject_hash=subject_hash))
        session.revoked = True
    else:
        if not existing:
            raise HTTPException(403, "Sign in by phone and link your government account first")
        farmer = db.scalar(select(Farmer).where(Farmer.id == existing.farmer_id).with_for_update())
        if not farmer or farmer.status != "active":
            raise HTTPException(401, "Account unavailable")
        require_consent(db, farmer, "government_identity")
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Government identity link changed. Sign in by phone and review the link.") from None
    issue_session(db, farmer, request.app.state.v2_settings, response)
    return response


@router.delete("/link")
def unlink(farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    for link in db.scalars(select(GovernmentIdentity).where(GovernmentIdentity.farmer_id == farmer.id)):
        db.delete(link)
    return {"status": "unlinked", "phone_sign_in_available": True}
