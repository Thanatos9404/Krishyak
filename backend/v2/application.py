"""Attach v2 without breaking public v1 planning routes."""

import asyncio

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import text

from db.session import make_database
from security import normalize_request_id

from .context import router as context_router
from .government import router as government_router
from .images import router as images_router
from .limits import Quotas
from .notifications import router as notifications_router
from .pilots import router as pilots_router
from .rights import router as rights_router
from .router import router
from .satellite import router as satellite_router
from .settings import Settings


def install_v2(app, settings=None):
    settings = settings or Settings.from_env()
    app.state.v2_settings = settings
    if settings.enabled:
        app.state.v2_engine, app.state.v2_database = make_database(settings)
        app.state.v2_quotas = Quotas(settings)
    app.include_router(router)
    app.include_router(satellite_router)
    app.include_router(images_router)
    app.include_router(rights_router)
    app.include_router(government_router)
    app.include_router(context_router)
    app.include_router(pilots_router)
    app.include_router(notifications_router)

    def private_response(response):
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if settings.deployed:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    def failure(request, code, message, status, *, retryable, headers=None):
        identifier = normalize_request_id(request.headers.get("X-Request-ID"))
        return private_response(
            JSONResponse(
                {"error": {"code": code, "message": message, "retryable": retryable, "request_id": identifier}},
                status_code=status,
                headers={**(headers or {}), "X-Request-ID": identifier},
            )
        )

    @app.middleware("http")
    async def v2_boundary(request, call_next):
        if settings.deployed and (
            request.url.path.startswith(
                (
                    "/sensors",
                    "/pest/report",
                    "/pest/history",
                    "/pest/statistics",
                    "/pest/alerts",
                    "/consent/",
                    "/verify/",
                    "/farmer/profile",
                )
            )
            or request.url.path == "/register-farmer"
        ):
            return JSONResponse(
                {
                    "success": False,
                    "error": "This legacy personal-data workflow is disabled. Use authenticated farm accounts.",
                },
                status_code=410,
            )
        if request.url.path.startswith("/api/v2"):
            if settings.enabled:
                try:
                    identity = request.client.host if request.client else "unknown"
                    request.app.state.v2_quotas.check("api_gateway", identity, 500, 60)
                except HTTPException as error:
                    return failure(
                        request,
                        "RATE_LIMITED" if error.status_code == 429 else "UNAVAILABLE",
                        error.detail,
                        error.status_code,
                        retryable=True,
                        headers=error.headers,
                    )
            if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
                # Bound body before JSON/multipart parsing, including chunked requests.
                maximum = 9 * 1024 * 1024 if request.url.path == "/api/v2/disease-scans" else 65536
                chunks, size = [], 0
                try:
                    async with asyncio.timeout(15):
                        async for chunk in request.stream():
                            size += len(chunk)
                            if size > maximum:
                                return failure(
                                    request, "PAYLOAD_LIMIT", "Request exceeds supported limits", 413, retryable=False
                                )
                            chunks.append(chunk)
                    request._body = b"".join(chunks)
                except Exception:
                    return failure(request, "INVALID_BODY", "Request interrupted", 400, retryable=True)
            response = await call_next(request)
            return private_response(response)
        return await call_next(request)

    @app.get("/health/live", tags=["Health"])
    def live():
        return {"status": "live"}

    @app.get("/health/ready", tags=["Health"])
    def ready():
        if not settings.enabled:
            return {"status": "ready", "v2": "disabled", "scope": "public planning only"}
        try:
            with app.state.v2_engine.connect() as connection:
                version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
                if version != "v2_0004":
                    raise ValueError("Migration required")
                connection.execute(text("SELECT PostGIS_Version()"))
                if settings.deployed:
                    recent = connection.execute(
                        text(
                            "SELECT seen_at > now() - interval '10 minutes' FROM v2_worker_heartbeat WHERE name='evidence-worker'"
                        )
                    ).scalar()
                    if not recent:
                        raise ValueError("Worker unavailable")
            if app.state.v2_quotas.redis is not None:
                app.state.v2_quotas.redis.ping()
        except Exception:
            raise HTTPException(503, "Core storage or usage controls unavailable") from None
        return {"status": "ready", "schema": version, "v2": "enabled"}
