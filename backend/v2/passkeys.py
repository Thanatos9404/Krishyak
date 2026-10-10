"""Passkey (WebAuthn) sign-in with one-time recovery codes.

Passkeys let a farmer sign in with the phone's fingerprint or screen lock, with no
SMS cost or telecom registration. The relying party is the exact browser origin
that the API already trusts for CSRF, so a credential registered on one deployed
hostname cannot be replayed against another. Challenges are single use, expire
after five minutes and are bound to that origin.
"""

import json
import re
import secrets
from datetime import timedelta
from typing import Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import Field, field_validator
from sqlalchemy import delete, func, select
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes, bytes_to_base64url
from webauthn.helpers.exceptions import InvalidAuthenticationResponse, InvalidRegistrationResponse
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    ResidentKeyRequirement,
    UserVerificationRequirement,
)

from db.models import Consent, Farmer, Passkey, RecoveryCode, WebAuthnChallenge, utcnow
from security import client_ip

from .auth import authenticate, check_origin, issue_session, token_hash
from .india import normalize_mobile
from .router import database, profile
from .schemas import Input

router = APIRouter(prefix="/api/v2", tags=["Passkey sign-in"])

POLICY_VERSION = "2026-10-03"
CHALLENGE_SECONDS = 300
RECENT_AUTH = timedelta(minutes=15)
# Crockford base32 without ambiguous letters; 20 symbols carry 100 bits.
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


class RegisterOptions(Input):
    display_name: str = Field(min_length=1, max_length=100)
    contact_mobile: str | None = Field(default=None, pattern=r"^\+91[6-9][0-9]{9}$")
    preferred_language: str = Field(default="en", min_length=2, max_length=10)
    accept_policy_version: Literal["2026-10-03"]

    @field_validator("contact_mobile", mode="before")
    @classmethod
    def optional_mobile(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return None
        return normalize_mobile(value)


class CredentialInput(Input):
    challenge_id: UUID
    credential: dict
    device_label: str = Field(default="This phone", min_length=1, max_length=100)

    @field_validator("credential")
    @classmethod
    def bounded(cls, value):
        if len(json.dumps(value)) > 16384:
            raise ValueError("Credential response is too large")
        return value


class RecoveryInput(Input):
    code: str = Field(min_length=16, max_length=40)


def settings_for(request):
    settings = request.app.state.v2_settings
    if not settings.enabled or not settings.passkey_enabled:
        raise HTTPException(503, "Passkey sign-in is unavailable")
    return settings


def relying_party(request):
    check_origin(request)
    origin = request.headers["origin"]
    return origin, urlsplit(origin).hostname


def new_recovery_code():
    raw = "".join(secrets.choice(ALPHABET) for _ in range(20))
    return "-".join(raw[i : i + 4] for i in range(0, 20, 4))


def normalize_recovery_code(value):
    cleaned = re.sub(r"[\s-]", "", value.upper()).replace("O", "0").replace("I", "1").replace("L", "1")
    if len(cleaned) != 20 or any(x not in ALPHABET for x in cleaned):
        raise HTTPException(400, "Recovery code is not valid")
    return "-".join(cleaned[i : i + 4] for i in range(0, 20, 4))


def replace_recovery_code(db, farmer, settings):
    code = new_recovery_code()
    db.execute(delete(RecoveryCode).where(RecoveryCode.farmer_id == farmer.id))
    db.add(RecoveryCode(farmer_id=farmer.id, code_hash=token_hash(code, settings)))
    return code


def store_challenge(db, purpose, origin, challenge, *, farmer_id=None, payload=None):
    record = WebAuthnChallenge(
        purpose=purpose,
        origin=origin,
        challenge=bytes_to_base64url(challenge),
        farmer_id=farmer_id,
        payload=payload or {},
        expires_at=utcnow() + timedelta(seconds=CHALLENGE_SECONDS),
    )
    db.add(record)
    db.flush()
    return record


def take_challenge(db, challenge_id, purpose, origin, farmer_id=None):
    record = db.scalar(select(WebAuthnChallenge).where(WebAuthnChallenge.id == challenge_id).with_for_update())
    if (
        record is None
        or record.consumed
        or record.purpose != purpose
        or record.expires_at <= utcnow()
        or record.origin != origin
        or record.farmer_id != farmer_id
    ):
        raise HTTPException(400, "Sign-in request expired; try again")
    record.consumed = True
    return record


def recent_session(request, db):
    farmer, session = authenticate(db, request, lock=True)
    if session.authenticated_at < utcnow() - RECENT_AUTH:
        raise HTTPException(401, "Confirm it is you: sign in again to change sign-in methods")
    return farmer, session


def passkey_summary(record):
    return {
        "id": record.id,
        "device_label": record.device_label,
        "created_at": record.created_at,
        "last_used_at": record.last_used_at,
        "synced": record.backed_up,
    }


def registration_options(rp_id, user_id, name, exclude=()):
    return generate_registration_options(
        rp_id=rp_id,
        rp_name="Krishyak",
        user_id=user_id,
        user_name=name,
        user_display_name=name,
        timeout=CHALLENGE_SECONDS * 1000,
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.REQUIRED,
            user_verification=UserVerificationRequirement.REQUIRED,
        ),
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(x)) for x in exclude],
    )


def verified_registration(record, credential, rp_id):
    try:
        return verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(record.challenge),
            expected_rp_id=rp_id,
            expected_origin=record.origin,
            require_user_verification=True,
        )
    except (InvalidRegistrationResponse, ValueError, KeyError, TypeError):
        raise HTTPException(400, "This passkey could not be verified; try again") from None


def save_passkey(db, farmer_id, verified, credential, label):
    credential_id = bytes_to_base64url(verified.credential_id)
    if db.scalar(select(Passkey.id).where(Passkey.credential_id == credential_id)):
        raise HTTPException(409, "This passkey is already registered")
    transports = credential.get("response", {}).get("transports") or []
    db.add(
        Passkey(
            farmer_id=farmer_id,
            credential_id=credential_id,
            public_key=verified.credential_public_key,
            sign_count=verified.sign_count,
            transports=[str(x)[:20] for x in transports][:8] if isinstance(transports, list) else [],
            device_label=label,
            backed_up=bool(verified.credential_backed_up),
        )
    )


@router.post("/auth/passkey/register/options")
def register_options(body: RegisterOptions, request: Request, db=Depends(database, scope="function")):
    settings_for(request)
    origin, rp_id = relying_party(request)
    quotas = request.app.state.v2_quotas
    quotas.check("passkey_register_ip", client_ip(request), 10, 3600)
    quotas.check("passkey_register_global", "global", 2000, 86400)
    farmer_id = uuid4()
    options = registration_options(rp_id, farmer_id.bytes, body.display_name)
    record = store_challenge(
        db,
        "register",
        origin,
        options.challenge,
        payload={
            "farmer_id": str(farmer_id),
            "display_name": body.display_name,
            "contact_mobile": body.contact_mobile,
            "preferred_language": body.preferred_language,
            "policy_version": body.accept_policy_version,
        },
    )
    return {"challenge_id": record.id, "options": json.loads(options_to_json(options))}


@router.post("/auth/passkey/register/verify")
def register_verify(
    body: CredentialInput, request: Request, response: Response, db=Depends(database, scope="function")
):
    settings = settings_for(request)
    origin, rp_id = relying_party(request)
    request.app.state.v2_quotas.check("passkey_verify_ip", client_ip(request), 30, 600)
    record = take_challenge(db, body.challenge_id, "register", origin)
    verified = verified_registration(record, body.credential, rp_id)
    payload = record.payload
    farmer = Farmer(
        id=UUID(payload["farmer_id"]),
        mobile=None,
        contact_mobile=payload.get("contact_mobile"),
        display_name=payload["display_name"],
        preferred_language=payload.get("preferred_language") or "en",
    )
    db.add(farmer)
    db.flush()
    save_passkey(db, farmer.id, verified, body.credential, body.device_label)
    db.add(
        Consent(
            farmer_id=farmer.id,
            purpose="account_operation",
            categories=["profile"],
            policy_version=payload["policy_version"],
            consent_version="v1",
            collection_surface="passkey_sign_up",
        )
    )
    code = replace_recovery_code(db, farmer, settings)
    auth = issue_session(db, farmer, settings, response)
    return {"farmer": profile(farmer), "recovery_code": code, **auth}


@router.post("/auth/passkey/login/options")
def login_options(request: Request, db=Depends(database, scope="function")):
    settings_for(request)
    origin, rp_id = relying_party(request)
    request.app.state.v2_quotas.check("passkey_login_ip", client_ip(request), 30, 600)
    options = generate_authentication_options(
        rp_id=rp_id,
        timeout=CHALLENGE_SECONDS * 1000,
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    record = store_challenge(db, "authenticate", origin, options.challenge)
    return {"challenge_id": record.id, "options": json.loads(options_to_json(options))}


@router.post("/auth/passkey/login/verify")
def login_verify(body: CredentialInput, request: Request, response: Response, db=Depends(database, scope="function")):
    settings = settings_for(request)
    origin, rp_id = relying_party(request)
    request.app.state.v2_quotas.check("passkey_verify_ip", client_ip(request), 30, 600)
    record = take_challenge(db, body.challenge_id, "authenticate", origin)
    credential_id = body.credential.get("id")
    passkey = (
        db.scalar(select(Passkey).where(Passkey.credential_id == credential_id).with_for_update())
        if isinstance(credential_id, str) and len(credential_id) <= 1400
        else None
    )
    if passkey is None:
        # Commit the consumed challenge so a probe cannot be replayed.
        db.commit()
        raise HTTPException(400, "This passkey is not registered with Krishyak")
    try:
        verified = verify_authentication_response(
            credential=body.credential,
            expected_challenge=base64url_to_bytes(record.challenge),
            expected_rp_id=rp_id,
            expected_origin=origin,
            credential_public_key=passkey.public_key,
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
    except (InvalidAuthenticationResponse, ValueError, KeyError, TypeError):
        db.commit()
        raise HTTPException(400, "This passkey could not be verified; try again") from None
    farmer = db.scalar(select(Farmer).where(Farmer.id == passkey.farmer_id).with_for_update())
    if farmer is None or farmer.status != "active":
        db.commit()
        raise HTTPException(403, "Account unavailable")
    passkey.sign_count, passkey.last_used_at = verified.new_sign_count, utcnow()
    passkey.backed_up = bool(verified.credential_backed_up)
    auth = issue_session(db, farmer, settings, response)
    return {"farmer": profile(farmer), **auth}


@router.post("/auth/recovery")
def recover(body: RecoveryInput, request: Request, response: Response, db=Depends(database, scope="function")):
    settings = settings_for(request)
    check_origin(request)
    quotas = request.app.state.v2_quotas
    quotas.check("recovery_ip", client_ip(request), 5, 3600)
    quotas.check("recovery_global", "global", 500, 86400)
    code = normalize_recovery_code(body.code)
    stored = db.scalar(
        select(RecoveryCode).where(RecoveryCode.code_hash == token_hash(code, settings)).with_for_update()
    )
    farmer = db.scalar(select(Farmer).where(Farmer.id == stored.farmer_id).with_for_update()) if stored else None
    if farmer is None or farmer.status != "active":
        raise HTTPException(400, "Recovery code is not valid")
    # Recovery codes are single use: the old code stops working immediately.
    fresh = replace_recovery_code(db, farmer, settings)
    auth = issue_session(db, farmer, settings, response)
    return {"farmer": profile(farmer), "recovery_code": fresh, **auth}


@router.get("/me/passkeys")
def list_passkeys(request: Request, db=Depends(database, scope="function")):
    farmer, _ = authenticate(db, request)
    records = db.scalars(select(Passkey).where(Passkey.farmer_id == farmer.id).order_by(Passkey.created_at)).all()
    has_code = db.scalar(select(RecoveryCode.id).where(RecoveryCode.farmer_id == farmer.id)) is not None
    return {
        "items": [passkey_summary(x) for x in records],
        "recovery_code_active": has_code,
        "verified_mobile": farmer.mobile is not None,
    }


@router.post("/me/passkeys/options")
def add_options(request: Request, db=Depends(database, scope="function")):
    settings_for(request)
    farmer, _ = recent_session(request, db)
    origin, rp_id = relying_party(request)
    existing = db.scalars(select(Passkey.credential_id).where(Passkey.farmer_id == farmer.id)).all()
    if len(existing) >= 10:
        raise HTTPException(422, "Remove an old device before adding another")
    options = registration_options(rp_id, farmer.id.bytes, farmer.display_name, existing)
    record = store_challenge(db, "add_device", origin, options.challenge, farmer_id=farmer.id)
    return {"challenge_id": record.id, "options": json.loads(options_to_json(options))}


@router.post("/me/passkeys/verify")
def add_verify(body: CredentialInput, request: Request, db=Depends(database, scope="function")):
    settings_for(request)
    farmer, _ = recent_session(request, db)
    origin, rp_id = relying_party(request)
    record = take_challenge(db, body.challenge_id, "add_device", origin, farmer.id)
    verified = verified_registration(record, body.credential, rp_id)
    save_passkey(db, farmer.id, verified, body.credential, body.device_label)
    db.flush()
    records = db.scalars(select(Passkey).where(Passkey.farmer_id == farmer.id).order_by(Passkey.created_at)).all()
    return {"items": [passkey_summary(x) for x in records]}


@router.delete("/me/passkeys/{passkey_id}")
def remove_passkey(passkey_id: UUID, request: Request, db=Depends(database, scope="function")):
    farmer, _ = recent_session(request, db)
    record = db.scalar(select(Passkey).where(Passkey.id == passkey_id, Passkey.farmer_id == farmer.id))
    if record is None:
        raise HTTPException(404, "Device not found")
    remaining = db.scalar(select(func.count()).select_from(Passkey).where(Passkey.farmer_id == farmer.id)) - 1
    otp_ready = farmer.mobile is not None and request.app.state.v2_settings.otp_provider != "disabled"
    if remaining < 1 and not otp_ready:
        raise HTTPException(422, "Keep at least one device so you can still sign in")
    db.delete(record)
    return {"status": "removed"}


@router.post("/me/recovery-code")
def regenerate_code(request: Request, db=Depends(database, scope="function")):
    settings = settings_for(request)
    farmer, _ = recent_session(request, db)
    # Other signed-in devices keep working; only the written-down code changes.
    code = replace_recovery_code(db, farmer, settings)
    return {"recovery_code": code}


def cleanup_challenges(db):
    db.execute(delete(WebAuthnChallenge).where(WebAuthnChallenge.expires_at < utcnow() - timedelta(hours=1)))
