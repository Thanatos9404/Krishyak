"""Durable Postgres job worker. Run separately from API request workers."""

import logging
import time
from datetime import datetime, timedelta
from uuid import uuid5

from geoalchemy2.shape import to_shape
from shapely.geometry import mapping
from sqlalchemy import delete, func, or_, select, text
from sqlalchemy.dialects.postgresql import insert

from db.models import (
    AuthChallenge,
    Consent,
    Farm,
    Farmer,
    Job,
    Notification,
    ObjectDeletion,
    Observation,
    Plot,
    Session,
    WorkerHeartbeat,
    utcnow,
)
from db.session import make_database
from remote_sensing.providers.base import ProviderError
from remote_sensing.schemas import FieldRequest
from remote_sensing.service import RemoteSensingService

from .providers import object_storage
from .settings import Settings

logger = logging.getLogger("krishyak.v2.worker")


def schedule_once(factory, settings, service):
    if not settings.satellite_schedule_enabled or service.status()["status"] != "ready":
        return 0
    now = utcnow()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    with factory.begin() as db:
        if not db.scalar(text("SELECT pg_try_advisory_xact_lock(88195213)")):
            return 0
        today = (
            select(Job.plot_id)
            .where(Job.created_at >= start, Job.payload["scheduled"].as_boolean().is_(True))
            .distinct()
        )
        count = db.scalar(select(func.count()).select_from(today.subquery()))
        available = max(0, settings.satellite_schedule_plots_per_day - count)
        if not available:
            return 0

        def permitted(purpose):
            return (
                select(Consent.id)
                .where(Consent.farmer_id == Farm.farmer_id, Consent.purpose == purpose, Consent.withdrawn_at.is_(None))
                .exists()
            )

        latest = select(func.max(Job.created_at)).where(Job.plot_id == Plot.id).correlate(Plot).scalar_subquery()
        candidates = db.scalars(
            select(Plot)
            .join(Farm)
            .join(Farmer)
            .where(
                Farmer.status == "active",
                Plot.boundary.is_not(None),
                ~Plot.id.in_(today),
                permitted("location_processing"),
                permitted("satellite_processing"),
            )
            .order_by(latest.asc().nulls_first(), Plot.id)
            .limit(available)
        ).all()
        # At most three queries per selected plot/day; global provider quotas
        # still apply. Scheduled collection is an explicit operator setting.
        for plot in candidates:
            for index in ["ndvi", "ndmi", "ndre"]:
                payload = {
                    "start_date": (now.date() - timedelta(days=90)).isoformat(),
                    "end_date": now.date().isoformat(),
                    "index": index,
                    "interval_days": 10,
                    "boundary_revision": plot.revision,
                    "scheduled": True,
                }
                operation = uuid5(plot.id, f"scheduled:{now.date()}:{plot.revision}:{index}")
                db.add(Job(plot_id=plot.id, operation_id=operation, kind="satellite", payload=payload))
        return len(candidates)


def run_once(factory, settings, service=None):
    with factory.begin() as db:
        job = db.scalar(
            select(Job)
            .where(
                Job.available_at <= utcnow(),
                or_(Job.status.in_(["pending", "retry"]), (Job.status == "running") & (Job.leased_until <= utcnow())),
            )
            .order_by(Job.available_at)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job is None:
            return False
        if job.attempts >= 3:
            job.status, job.error_code, job.leased_until = "failed", "attempts_exhausted", None
            return True
        job.status, job.leased_until = "running", utcnow() + timedelta(minutes=5)
        job.attempts += 1
        job_id, plot_id, payload = job.id, job.plot_id, dict(job.payload)
        attempt = job.attempts
        plot = db.get(Plot, plot_id)
        farm = db.get(Farm, plot.farm_id) if plot else None
        owner = db.get(Farmer, farm.farmer_id) if farm else None
        consent = (
            db.scalar(
                select(Consent.id).where(
                    Consent.farmer_id == farm.farmer_id,
                    Consent.purpose == "satellite_processing",
                    Consent.withdrawn_at.is_(None),
                )
            )
            if farm
            else None
        )
        location_consent = (
            db.scalar(
                select(Consent.id).where(
                    Consent.farmer_id == farm.farmer_id,
                    Consent.purpose == "location_processing",
                    Consent.withdrawn_at.is_(None),
                )
            )
            if farm
            else None
        )
        if (
            plot is None
            or not owner
            or owner.status != "active"
            or not consent
            or not location_consent
            or plot.boundary is None
            or plot.revision != payload["boundary_revision"]
        ):
            job.status = "cancelled"
            return True
        geometry = mapping(to_shape(plot.boundary))
    try:
        request = FieldRequest(
            geometry=geometry,
            start_date=payload["start_date"],
            end_date=payload["end_date"],
            index=payload["index"],
            interval_days=payload["interval_days"],
        )
        service = service or RemoteSensingService()
        result, _ = service.execute("timeseries", request, f"job:{plot_id}")
        # A deleted plot/account or revoked consent during external processing
        # must not cause freshly fetched evidence to be published.
        with factory.begin() as db:
            target = db.scalar(select(Farm.farmer_id).join(Plot).where(Plot.id == plot_id))
            owner = db.scalar(select(Farmer).where(Farmer.id == target).with_for_update()) if target else None
            job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
            if job is None or job.status != "running" or job.attempts != attempt:
                return True
            plot = db.scalar(select(Plot).where(Plot.id == plot_id).with_for_update())
            farm = db.get(Farm, plot.farm_id) if plot else None
            permissions = (
                set(
                    db.scalars(
                        select(Consent.purpose).where(
                            Consent.farmer_id == farm.farmer_id, Consent.withdrawn_at.is_(None)
                        )
                    ).all()
                )
                if farm
                else set()
            )
            if (
                not plot
                or not owner
                or owner.status != "active"
                or plot.revision != payload["boundary_revision"]
                or not {"location_processing", "satellite_processing"}.issubset(permissions)
            ):
                job.status = "cancelled"
                return True
            import hashlib
            import json

            for observed in result["observations"]:
                key = f"{payload['index']}:{observed['start']}:{observed['end']}:{payload['interval_days']}:{payload['boundary_revision']}:krishyak-s2-v1"
                operation_id = uuid5(plot_id, key)
                if db.scalar(
                    select(Observation.id).where(
                        Observation.plot_id == plot_id, Observation.operation_id == operation_id
                    )
                ):
                    continue
                observation_payload = {"index": payload["index"], "observation": observed}
                provenance = result["provenance"] | {
                    "boundary_revision": plot.revision,
                    "aggregation_days": payload["interval_days"],
                }
                db.add(
                    Observation(
                        plot_id=plot_id,
                        kind="remote_sensing",
                        source_type="remote_sensing",
                        source=service.provider.name,
                        observed_at=datetime.fromisoformat(observed["end"].replace("Z", "+00:00")),
                        payload=observation_payload,
                        provenance=provenance,
                        operation_id=operation_id,
                        payload_hash=hashlib.sha256(
                            json.dumps(observation_payload, sort_keys=True).encode()
                        ).hexdigest(),
                    )
                )
            job.status, job.error_code, job.leased_until = "completed", None, None
            notification_id = uuid5(job.operation_id, "satellite-complete")
            if not db.scalar(
                select(Notification.id).where(
                    Notification.farmer_id == farm.farmer_id, Notification.operation_id == notification_id
                )
            ):
                db.add(
                    Notification(
                        farmer_id=farm.farmer_id,
                        plot_id=plot.id,
                        operation_id=notification_id,
                        kind="satellite_updated",
                        payload={
                            "title": "Satellite processing completed",
                            "message": "Review the latest field evidence and its quality before taking action.",
                            "job_id": str(job.id),
                            "boundary_revision": plot.revision,
                        },
                    )
                )
    except Exception as exc:
        code = exc.code if isinstance(exc, ProviderError) else "processing_failed"
        with factory.begin() as db:
            job = db.get(Job, job_id)
            if job and job.status == "running" and job.attempts == attempt:
                retryable = not isinstance(exc, ProviderError) or exc.status in {429, 500, 502, 503, 504}
                job.status = "retry" if retryable and job.attempts < 3 else "failed"
                job.error_code, job.leased_until = code, None
                job.available_at = utcnow() + timedelta(seconds=30 * 2**job.attempts)
        # No payload, geometry, phone, provider body or secret in logs.
        logger.warning("Satellite job failed code=%s", code)
    return True


def cleanup_once(factory, settings):
    with factory.begin() as db:
        from db.models import AuditLog, ImageAsset

        expired = db.scalars(
            select(ImageAsset)
            .where(ImageAsset.created_at < utcnow() - timedelta(days=settings.image_retention_days))
            .limit(100)
        ).all()
        for asset in expired:
            if not db.scalar(select(ObjectDeletion.id).where(ObjectDeletion.object_key == asset.object_key)):
                db.add(ObjectDeletion(object_key=asset.object_key))
            db.delete(asset)
        db.execute(
            delete(AuditLog).where(AuditLog.created_at < utcnow() - timedelta(days=settings.audit_retention_days))
        )
        deletion = db.scalar(
            select(ObjectDeletion)
            .where(ObjectDeletion.status.in_(["pending", "retry"]), ObjectDeletion.available_at <= utcnow())
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if deletion:
            deletion.attempts += 1
            try:
                object_storage(settings).delete(deletion.object_key)
                db.delete(deletion)
            except Exception:
                deletion.status = "retry" if deletion.attempts < 10 else "failed"
                deletion.available_at = utcnow() + timedelta(seconds=min(3600, 30 * 2**deletion.attempts))
        db.execute(delete(AuthChallenge).where(AuthChallenge.expires_at < utcnow() - timedelta(days=1)))
        db.execute(delete(Session).where(Session.refresh_expires_at < utcnow()))


def main():
    settings = Settings.from_env()
    if not settings.enabled:
        raise ValueError("V2 worker requires an enabled deployment")
    engine, factory = make_database(settings)
    service = RemoteSensingService()
    scheduled_at = 0.0
    try:
        while True:
            try:
                with factory.begin() as db:
                    db.execute(
                        insert(WorkerHeartbeat)
                        .values(name="evidence-worker", seen_at=utcnow())
                        .on_conflict_do_update(index_elements=[WorkerHeartbeat.name], set_={"seen_at": utcnow()})
                    )
                if time.monotonic() - scheduled_at >= 60:
                    schedule_once(factory, settings, service)
                    scheduled_at = time.monotonic()
                worked = run_once(factory, settings, service)
                cleanup_once(factory, settings)
                if not worked:
                    time.sleep(2)
            except Exception as error:
                # Durable jobs survive storage outages. Retry the loop without
                # putting a DSN, SQL parameters or provider response in logs.
                logger.warning("Worker iteration unavailable type=%s", type(error).__name__)
                time.sleep(5)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
