"""Serverless execution of the durable Postgres job queue.

In ``request`` worker mode there is no resident process. Work is drained by:

* a bounded background drain right after a farmer enqueues a job, and
* an authenticated scheduled trigger (Vercel Cron sends ``Authorization:
  Bearer $CRON_SECRET``) that runs scheduled collection, retries and retention
  cleanup.

Both paths reuse the dedicated worker's leasing (``SKIP LOCKED``), consent and
boundary-revision checks, so concurrent invocations cannot double-publish.
"""

import logging
import os
import secrets
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

logger = logging.getLogger("krishyak.v2.worker")
router = APIRouter(prefix="/api/v2/internal", tags=["Operations"], include_in_schema=False)


def drain(app, max_jobs=2, seconds=40):
    from remote_sensing.router import get_service

    from .worker import run_batch

    settings = app.state.v2_settings
    try:
        return run_batch(app.state.v2_database, settings, get_service(), max_jobs=max_jobs, seconds=seconds)
    except Exception as error:
        # Jobs stay durable for the next trigger; never log payloads or secrets.
        logger.warning("Request-mode drain unavailable type=%s", type(error).__name__)
        return 0


def schedule_drain(request: Request, tasks: BackgroundTasks):
    settings = request.app.state.v2_settings
    if settings.enabled and settings.worker_mode == "request":
        tasks.add_task(drain, request.app, 1, 40)


def authorized(request):
    settings = request.app.state.v2_settings
    expected = settings.cron_secret.get_secret_value()
    supplied = request.headers.get("authorization", "")
    return (
        settings.enabled
        and len(expected) >= 32
        and secrets.compare_digest(supplied.encode(), f"Bearer {expected}".encode())
    )


@router.get("/worker")
def scheduled_trigger(request: Request):
    if request.app.state.v2_settings.worker_mode != "request" or not authorized(request):
        raise HTTPException(404, "Not found")
    completed = drain(request.app, max_jobs=6, seconds=45)
    return {"worker_batch": "completed", "jobs_processed": completed}


@router.post("/migrate")
def migrate(request: Request):
    """Apply Alembic migrations from inside a serverless deployment.

    Managed databases may expose credentials only to the deployment (Vercel
    sensitive variables). Disabled unless V2_HTTP_MIGRATIONS=true; requires the
    cron secret; uses the direct (unpooled) URL under a Postgres advisory lock.
    """
    if os.getenv("V2_HTTP_MIGRATIONS", "false").lower() != "true" or not authorized(request):
        raise HTTPException(404, "Not found")
    from alembic import command
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import create_engine, pool, text

    from .settings import migration_url_from_env

    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    config.set_main_option("script_location", str(root / "migrations"))
    try:
        command.upgrade(config, "head")
        engine = create_engine(migration_url_from_env(), poolclass=pool.NullPool)
        with engine.connect() as connection:
            version = connection.execute(text("SELECT version_num FROM alembic_version")).scalar()
        engine.dispose()
    except Exception as error:
        logger.warning("HTTP migration failed type=%s", type(error).__name__)
        raise HTTPException(503, "Migration failed; schema unchanged or partially locked, retry") from None
    return {"schema": version, "head": ScriptDirectory.from_config(config).get_current_head()}
