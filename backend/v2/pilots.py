"""Opt-in pilot cohorts and institution-scoped aggregate evidence, not impact claims."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field, field_validator
from sqlalchemy import Text, cast, func, select

from db.models import (
    AuditLog,
    Consent,
    CropCycle,
    Farm,
    Feedback,
    ImageAsset,
    Notification,
    Observation,
    PilotCohort,
    PilotEnrollment,
    Plot,
    utcnow,
)
from repositories.ownership import owned_plot

from .auth import authenticate
from .images import reviewer
from .router import current_farmer, database, require_consent, serialize
from .schemas import Input

router = APIRouter(prefix="/api/v2", tags=["Consented pilot operations"])


class CohortInput(Input):
    name: str = Field(min_length=1, max_length=100)
    district: str = Field(min_length=1, max_length=100)
    crops: list[str] = Field(min_length=1, max_length=10)

    @field_validator("crops")
    @classmethod
    def supported(cls, values):
        import config

        if len(set(values)) != len(values) or any(crop not in config.CROPS for crop in values):
            raise ValueError("Use distinct supported planning crops")
        return values


class EnrollmentInput(Input):
    plot_ids: list[UUID] = Field(min_length=1, max_length=50)


def institution(farmer, request, db):
    _, session = authenticate(db, request)
    from datetime import timedelta

    if farmer.role not in {"organisation_admin", "admin"}:
        raise HTTPException(403, "Institutional role required")
    if session.authenticated_at < utcnow() - timedelta(minutes=10):
        raise HTTPException(401, "Sign in again before institutional operations")


def own_cohort(db, farmer, cohort_id):
    cohort = db.scalar(
        select(PilotCohort).where(PilotCohort.id == cohort_id, PilotCohort.organisation_admin_id == farmer.id)
    )
    if cohort is None:
        raise HTTPException(404, "Pilot cohort not found")
    return cohort


@router.get("/admin/pilots")
def cohorts(
    request: Request,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    institution(farmer, request, db)
    records = db.scalars(
        select(PilotCohort)
        .where(PilotCohort.organisation_admin_id == farmer.id)
        .order_by(PilotCohort.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return {"items": [serialize(record) for record in records]}


@router.post("/admin/pilots", status_code=201)
def create_cohort(
    body: CohortInput, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    institution(farmer, request, db)
    if (
        len(db.scalars(select(PilotCohort.id).where(PilotCohort.organisation_admin_id == farmer.id).limit(50)).all())
        >= 50
    ):
        raise HTTPException(422, "Maximum pilot cohorts reached")
    cohort = PilotCohort(organisation_admin_id=farmer.id, **body.model_dump())
    db.add(cohort)
    db.flush()
    db.add(AuditLog(actor_id=farmer.id, action="pilot_created", target_id=cohort.id))
    return serialize(cohort)


@router.get("/pilot-enrollments")
def enrollments(farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    records = db.scalars(select(PilotEnrollment).where(PilotEnrollment.farmer_id == farmer.id).limit(100))
    return {"items": [serialize(record) for record in records]}


@router.post("/pilot-enrollments/{cohort_id}", status_code=201)
def enroll(
    cohort_id: UUID, body: EnrollmentInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    consent = require_consent(db, farmer, "pilot_research")
    cohort = db.get(PilotCohort, cohort_id)
    if cohort is None or cohort.status not in {"planned", "active"}:
        raise HTTPException(404, "Available pilot cohort not found")
    ids = sorted(set(map(str, body.plot_ids)))
    for plot_id in body.plot_ids:
        owned_plot(db, farmer.id, plot_id)
    record = db.scalar(
        select(PilotEnrollment).where(PilotEnrollment.cohort_id == cohort_id, PilotEnrollment.farmer_id == farmer.id)
    )
    if record is None:
        record = PilotEnrollment(cohort_id=cohort_id, farmer_id=farmer.id, consent_id=consent.id, plot_ids=ids)
        db.add(record)
    else:
        record.consent_id, record.withdrawn_at, record.plot_ids = consent.id, None, ids
    db.flush()
    db.add(AuditLog(actor_id=farmer.id, action="pilot_enrolled", target_id=cohort_id))
    return serialize(record)


@router.delete("/pilot-enrollments/{enrollment_id}")
def withdraw(enrollment_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    record = db.scalar(
        select(PilotEnrollment).where(PilotEnrollment.id == enrollment_id, PilotEnrollment.farmer_id == farmer.id)
    )
    if record is None:
        raise HTTPException(404, "Pilot enrollment not found")
    record.withdrawn_at = record.withdrawn_at or utcnow()
    db.add(AuditLog(actor_id=farmer.id, action="pilot_withdrawn", target_id=record.cohort_id))
    return {"status": "withdrawn"}


@router.get("/admin/pilots/{cohort_id}/report")
def report(cohort_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    institution(farmer, request, db)
    cohort = own_cohort(db, farmer, cohort_id)
    enrolled = (
        select(PilotEnrollment)
        .join(Consent, PilotEnrollment.consent_id == Consent.id)
        .where(
            PilotEnrollment.cohort_id == cohort_id,
            PilotEnrollment.withdrawn_at.is_(None),
            Consent.withdrawn_at.is_(None),
            Consent.purpose == "pilot_research",
        )
    ).subquery()
    owner_count = db.scalar(select(func.count()).select_from(enrolled))
    plots = (
        select(Plot.id)
        .join(Farm)
        .join(enrolled, enrolled.c.farmer_id == Farm.farmer_id)
        .where(enrolled.c.plot_ids.contains(func.jsonb_build_array(cast(Plot.id, Text))))
    )
    plot_count = db.scalar(select(func.count()).select_from(plots.subquery()))
    # Suppress distributions/outcomes for small cohorts. No phones, polygons,
    # member identifiers or row-level private notes enter institutional reports.
    sufficient = owner_count >= 5
    crops = (
        dict(
            db.execute(
                select(CropCycle.crop, func.count())
                .where(CropCycle.plot_id.in_(plots), CropCycle.status == "active")
                .group_by(CropCycle.crop)
            ).all()
        )
        if sufficient
        else None
    )
    events = (
        dict(
            db.execute(
                select(Observation.kind, func.count()).where(Observation.plot_id.in_(plots)).group_by(Observation.kind)
            ).all()
        )
        if sufficient
        else None
    )
    acknowledgements = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.plot_id.in_(plots), Notification.acknowledged_at.is_not(None))
        )
        if sufficient
        else None
    )
    db.add(AuditLog(actor_id=farmer.id, action="pilot_report_viewed", target_id=cohort.id))
    return {
        "cohort": {"id": cohort.id, "name": cohort.name, "district": cohort.district},
        "evidence_category": "consented_account_records",
        "enrolled_farmers": owner_count,
        "enrolled_plots": plot_count,
        "crop_distribution": crops,
        "recorded_events": events,
        "in_app_acknowledgements": acknowledgements,
        "yield_improvement": None,
        "income_improvement": None,
        "field_validated": False,
        "suppressed_small_cohort": not sufficient,
        "limitations": [
            "Record counts are not measured agronomic impact",
            "Farmer-entered outcomes are not independently verified",
            "Distributions require at least five consented farmers",
            "No unrecorded outcome is inferred",
        ],
    }


@router.get("/admin/model-monitoring")
def model_monitoring(request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    reviewer(farmer, request, db)
    images = (
        select(ImageAsset.id, ImageAsset.result)
        .join(Consent, ImageAsset.research_consent_id == Consent.id)
        .where(Consent.withdrawn_at.is_(None), Consent.purpose == "model_improvement")
    ).subquery()
    scan_count = db.scalar(select(func.count()).select_from(images))

    def grouped(key):
        return dict(
            db.execute(select(images.c.result[key].astext, func.count()).group_by(images.c.result[key].astext)).all()
        )

    responses, rejected, reviews, corrected = db.execute(
        select(
            func.count().filter(Feedback.verdict.in_(["yes", "no", "unsure"])),
            func.count().filter(Feedback.verdict == "no"),
            func.count().filter(Feedback.reviewed_at.is_not(None)),
            func.count().filter(
                Feedback.reviewed_at.is_not(None), Feedback.corrected_class != images.c.result["predicted_class"].astext
            ),
        )
        .select_from(Feedback)
        .join(images, Feedback.image_id == images.c.id)
    ).one()
    db.add(AuditLog(actor_id=farmer.id, action="model_aggregate_viewed"))
    return {
        "scope": "currently research-consented images only",
        "scans": scan_count,
        "by_model": grouped("model_id"),
        "by_status": grouped("status"),
        "farmer_responses": responses,
        "farmer_disagreement_rate": rejected / responses if responses else None,
        "expert_reviews": reviews,
        "expert_disagreement_rate": corrected / reviews if reviews else None,
        "field_accuracy": None,
        "limitations": [
            "Feedback is selected and may be biased",
            "Repeated reviewers/responses are records, not independent samples",
            "Operational agreement is not field accuracy",
            "No images or identity details included",
        ],
    }
