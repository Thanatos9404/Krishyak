"""Opaque, hashed and rotating sessions; CSRF double-submit plus Origin binding."""

import hashlib
import hmac
import secrets
from datetime import timedelta

from fastapi import HTTPException, Request, Response
from sqlalchemy import select

from db.models import Farmer, Session, utcnow

ACCESS_COOKIE = "krishyak_session"
REFRESH_COOKIE = "krishyak_refresh"
CSRF_COOKIE = "krishyak_csrf"


def token_hash(value, settings):
    return hmac.new(settings.auth_secret.get_secret_value().encode(), value.encode(), hashlib.sha256).hexdigest()


def check_origin(request: Request):
    settings = request.app.state.v2_settings
    if request.headers.get("origin") not in settings.origins:
        raise HTTPException(403, "Untrusted request origin")


def csrf_check(request, session):
    check_origin(request)
    csrf = request.headers.get("x-csrf-token", "")
    cookie = request.cookies.get(CSRF_COOKIE, "")
    if (
        not csrf
        or len(csrf) > 200
        or not secrets.compare_digest(csrf, cookie)
        or not secrets.compare_digest(token_hash(csrf, request.app.state.v2_settings), session.csrf_hash)
    ):
        raise HTTPException(403, "Session verification required")


def authenticate(db, request, *, refresh=False, lock=False):
    settings = request.app.state.v2_settings
    token = request.cookies.get(REFRESH_COOKIE if refresh else ACCESS_COOKIE, "")
    if not token or len(token) > 200:
        raise HTTPException(401, "Sign in required")
    column = Session.refresh_hash if refresh else Session.token_hash
    query = select(Session).where(column == token_hash(token, settings), Session.revoked.is_(False))
    session = db.scalar(query)
    if session is None or (session.refresh_expires_at if refresh else session.expires_at) <= utcnow():
        raise HTTPException(401, "Session expired")
    # All account mutations use the same lock order: farmer, then session or
    # domain record. Consent withdrawal and deletion cannot race a new write.
    farmer_query = select(Farmer).where(Farmer.id == session.farmer_id)
    if lock or request.method not in {"GET", "HEAD", "OPTIONS"}:
        farmer_query = farmer_query.with_for_update()
    farmer = db.scalar(farmer_query.execution_options(populate_existing=True))
    if lock:
        session = db.scalar(query.with_for_update().execution_options(populate_existing=True))
        if session is None or session.revoked:
            raise HTTPException(401, "Session expired")
    if farmer is None or farmer.status != "active":
        raise HTTPException(401, "Account unavailable")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        csrf_check(request, session)
    return farmer, session


def issue_session(db, farmer, settings, response: Response, *, refresh_deadline=None, authenticated_at=None):
    access, refresh, csrf = (secrets.token_urlsafe(32) for _ in range(3))
    session = Session(
        farmer_id=farmer.id,
        token_hash=token_hash(access, settings),
        refresh_hash=token_hash(refresh, settings),
        csrf_hash=token_hash(csrf, settings),
        expires_at=utcnow() + timedelta(seconds=settings.session_seconds),
        refresh_expires_at=refresh_deadline or utcnow() + timedelta(seconds=settings.refresh_seconds),
        authenticated_at=authenticated_at or utcnow(),
    )
    db.add(session)
    secure = settings.deployed
    same_site = "lax"
    refresh_age = max(1, int((session.refresh_expires_at - utcnow()).total_seconds()))
    for name, token, http_only, age in [
        (ACCESS_COOKIE, access, True, settings.session_seconds),
        (REFRESH_COOKIE, refresh, True, refresh_age),
        (CSRF_COOKIE, csrf, False, refresh_age),
    ]:
        response.set_cookie(
            name, token, max_age=age, httponly=http_only, secure=secure, samesite=same_site, path="/api/v2"
        )
    # Frontends on a sibling origin cannot read the API origin's csrf cookie.
    return {"csrf_token": csrf, "expires_in": settings.session_seconds}


def clear_session(response, settings):
    for name in (ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE):
        response.delete_cookie(name, path="/api/v2", secure=settings.deployed, samesite="lax")
