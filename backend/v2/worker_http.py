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
import secrets

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


@router.get("/worker")
def scheduled_trigger(request: Request):
    settings = request.app.state.v2_settings
    expected = settings.cron_secret.get_secret_value()
    supplied = request.headers.get("authorization", "")
    if (
        not settings.enabled
        or settings.worker_mode != "request"
        or len(expected) < 32
        or not secrets.compare_digest(supplied.encode(), f"Bearer {expected}".encode())
    ):
        raise HTTPException(404, "Not found")
    completed = drain(request.app, max_jobs=6, seconds=45)
    return {"worker_batch": "completed", "jobs_processed": completed}
