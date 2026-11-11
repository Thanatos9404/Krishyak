"""Krishyak Verify: a consented satellite check of one field for a lender or insurer.

The institution creates a request and gives its code to the farmer. Only after
the farmer enters the code, picks a mapped field and agrees does Krishyak
compare what the farmer declared (crop, sowing date, area) with Sentinel-2
greenness over that field. The report says what the satellite record supports,
what it cannot show and when a person should look; it never decides a loan or
claim.
"""

import secrets
from datetime import date, timedelta
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from geoalchemy2.shape import to_shape
from pydantic import Field
from sqlalchemy import func, select

from db.models import AuditLog, CropCycle, Farmer, ImageAsset, Job, Observation, Verification, utcnow
from repositories.ownership import owned_plot

from .crops import BY_ID
from .groups import ALPHABET, organiser
from .router import current_farmer, database, require_consent
from .schemas import Input
from .worker_http import schedule_drain

router = APIRouter(prefix="/api/v2", tags=["Krishyak Verify"])
SHARED = [
    "Your name, village and district",
    "The field you pick: crop, sowing date, area and rounded location (about 1 km)",
    "Satellite greenness of that field since sowing, and how many leaf photos you checked there",
]
NEVER_SHARED = ["Phone number", "Field outline", "Your photographs", "Other fields, notes, costs and sales"]
LIMITS = [
    "Sentinel-2 greenness shows that plants grew, not which crop they are",
    "Cloud can hide the field for weeks; missing views are not evidence against the farmer",
    "This report supports a decision by a person; it is not an approval or a rejection",
]


class RequestInput(Input):
    reference: str = Field(min_length=1, max_length=60)
    purpose: Literal["crop_loan", "crop_insurance", "other"]


class AcceptInput(Input):
    plot_id: UUID


def assess(sowing: date, series: list, today: date, harvest: date | None = None):
    """Compare a declared sowing date with clear NDVI views of the field.

    ``series`` holds (start, end, mean) for clear intervals, oldest first.
    """
    days = (today - sowing).days
    end = min(today, harvest) if harvest else today
    before = [
        mean for start, finish, mean in series if sowing - timedelta(days=30) <= finish <= sowing + timedelta(days=10)
    ]
    season = [(start, mean) for start, finish, mean in series if sowing + timedelta(days=20) <= start <= end]
    late = [mean for start, mean in season if start >= sowing + timedelta(days=40)]
    findings = {
        "clear_views_in_season": len(season),
        "greenness_at_sowing": round(min(before), 2) if before else None,
        "peak_greenness": round(max(mean for _, mean in season), 2) if season else None,
        "days_since_sowing": days,
    }
    if days < 30:
        return "too_early", "crop_growth_not_visible_yet", findings
    if not season:
        return "not_enough_evidence", "no_clear_view_since_sowing", findings
    peak = findings["peak_greenness"]
    base = findings["greenness_at_sowing"]
    if base is not None and base >= 0.5 and peak - base < 0.1:
        # Dense green before the declared sowing date and no fresh rise.
        return "needs_review", "green_before_declared_sowing", findings
    rise = next((start for start, mean in season if mean >= (base if base is not None else 0.2) + 0.1), None)
    findings["green_up_days_after_sowing"] = (rise - sowing).days if rise else None
    if peak >= 0.4 and (base is None or peak - base >= 0.15):
        return "consistent", "crop_growth_after_declared_sowing", findings
    if len(late) >= 2 and peak < 0.25:
        return "needs_review", "no_crop_growth_seen", findings
    return "not_enough_evidence", "growth_signal_unclear", findings


def evaluate(db, record):
    """Fresh result from the satellite record; saved so both sides read the same report."""
    if record.status not in {"processing", "ready"} or record.plot_id is None:
        return
    from db.models import Plot

    plot = db.get(Plot, record.plot_id)
    rows = db.scalars(
        select(Observation)
        .where(Observation.plot_id == plot.id, Observation.kind == "remote_sensing")
        .order_by(Observation.observed_at)
        .limit(300)
    ).all()
    series = [
        (
            date.fromisoformat(row.payload["observation"]["start"][:10]),
            date.fromisoformat(row.payload["observation"]["end"][:10]),
            row.payload["observation"]["mean"],
        )
        for row in rows
        if row.payload.get("index") == "ndvi"
        and row.payload["observation"].get("quality_status") == "clear"
        and row.provenance.get("boundary_revision") == record.declared["boundary_revision"]
    ]
    job = db.scalar(
        select(Job)
        .where(Job.plot_id == plot.id, Job.operation_id == UUID(record.declared["satellite_operation"]))
        .limit(1)
    )
    waiting = job is not None and job.status in {"pending", "retry", "running"}
    sowing = date.fromisoformat(record.declared["sowing_date"])
    harvest = date.fromisoformat(record.declared["expected_harvest"])
    verdict, reason, findings = assess(sowing, series, utcnow().date(), harvest)
    mapped, declared = record.declared["mapped_hectares"], record.declared["entered_hectares"]
    area_gap = abs(mapped - declared) / declared if declared else None
    if area_gap is not None and area_gap > 0.25 and verdict == "consistent":
        verdict, reason = "needs_review", "mapped_area_differs_from_declared"
    photos = db.scalar(
        select(func.count())
        .select_from(ImageAsset)
        .where(
            ImageAsset.plot_id == plot.id,
            ImageAsset.result["kind"].astext.is_(None),
            ImageAsset.result["crop_id"].astext == record.declared["crop_id"],
            ImageAsset.created_at >= record.accepted_at - timedelta(days=60),
        )
    )
    if waiting and verdict == "not_enough_evidence":
        reason = "satellite_check_running"
    record.status = "processing" if reason == "satellite_check_running" else "ready"
    record.result = {
        "verdict": verdict,
        "reason": reason,
        "human_review": verdict != "consistent",
        "findings": findings | {"area_difference_percent": round(area_gap * 100) if area_gap is not None else None},
        "leaf_photos_of_declared_crop": photos,
        "series": [
            {"from": start.isoformat(), "to": end.isoformat(), "ndvi": round(mean, 3)} for start, end, mean in series
        ],
        "satellite": "Sentinel-2 L2A NDVI, field average of clear pixels, 10-day intervals",
        "satellite_job": job.status if job else "not_requested",
        "evaluated_at": utcnow().isoformat(),
        "limitations": LIMITS,
    }


def view(record, *, requester_name=None, farmer=None):
    body = {
        "id": record.id,
        "reference": record.reference,
        "purpose": record.purpose,
        "status": record.status,
        "created_at": record.created_at,
        "expires_at": record.expires_at,
        "accepted_at": record.accepted_at,
        "declared": {
            key: record.declared.get(key)
            for key in (
                "crop_id",
                "crop",
                "sowing_date",
                "expected_harvest",
                "entered_hectares",
                "mapped_hectares",
                "location",
            )
        }
        if record.declared
        else None,
        "result": record.result or None,
    }
    if requester_name is not None:
        body["requester"] = requester_name
    if farmer is not None:
        body["farmer"] = {
            "name": farmer.display_name,
            "village": farmer.village,
            "district": farmer.district,
            "state": farmer.state,
        }
    return body


@router.post("/admin/verifications", status_code=201)
def create_request(
    body: RequestInput, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    organiser(farmer, request, db, fresh_minutes=10)
    request.app.state.v2_quotas.check("verify_create", str(farmer.id), 200, 86400)
    record = Verification(
        requester_id=farmer.id,
        reference=body.reference,
        purpose=body.purpose,
        code="".join(secrets.choice(ALPHABET) for _ in range(8)),
        expires_at=utcnow() + timedelta(days=30),
    )
    db.add(record)
    db.flush()
    db.add(AuditLog(actor_id=farmer.id, action="verification_requested", target_id=record.id))
    return view(record) | {"code": record.code}


@router.get("/admin/verifications")
def requests(request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    organiser(farmer, request, db, fresh_minutes=720)
    rows = db.scalars(
        select(Verification)
        .where(Verification.requester_id == farmer.id)
        .order_by(Verification.created_at.desc())
        .limit(100)
    ).all()
    return {
        "items": [
            {
                "id": row.id,
                "reference": row.reference,
                "purpose": row.purpose,
                "status": row.status,
                "created_at": row.created_at,
                "code": row.code if row.status == "awaiting_farmer" else None,
                "verdict": (row.result or {}).get("verdict"),
            }
            for row in rows
        ]
    }


@router.get("/admin/verifications/{verification_id}")
def report(
    verification_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    organiser(farmer, request, db, fresh_minutes=720)
    record = db.scalar(
        select(Verification)
        .where(Verification.id == verification_id, Verification.requester_id == farmer.id)
        .with_for_update()
    )
    if record is None:
        raise HTTPException(404, "Verification not found")
    evaluate(db, record)
    subject = (
        db.get(Farmer, record.farmer_id) if record.farmer_id and record.status in {"processing", "ready"} else None
    )
    db.add(AuditLog(actor_id=farmer.id, action="verification_viewed", target_id=record.id))
    return view(record, farmer=subject) | {"shared": SHARED, "never_shared": NEVER_SHARED}


def open_request(db, code):
    record = db.scalar(select(Verification).where(Verification.code == code.upper()).with_for_update())
    if record is None or record.status != "awaiting_farmer" or record.expires_at < utcnow():
        raise HTTPException(404, "This code is not valid or has already been used.")
    return record


@router.get("/verifications/lookup/{code}")
def lookup(code: str, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    request.app.state.v2_quotas.check("verify_lookup", str(farmer.id), 20, 3600)
    record = open_request(db, code)
    requester = db.get(Farmer, record.requester_id)
    return {
        "requester": requester.display_name,
        "reference": record.reference,
        "purpose": record.purpose,
        "shared": SHARED,
        "never_shared": NEVER_SHARED,
        "limitations": LIMITS,
    }


@router.post("/verifications/{code}/accept", status_code=201)
def accept(
    code: str,
    body: AcceptInput,
    request: Request,
    tasks: BackgroundTasks,
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    request.app.state.v2_quotas.check("verify_lookup", str(farmer.id), 20, 3600)
    require_consent(db, farmer, "location_processing")
    require_consent(db, farmer, "satellite_processing")
    record = open_request(db, code)
    if record.requester_id == farmer.id:
        raise HTTPException(422, "You cannot answer your own request")
    plot = owned_plot(db, farmer.id, body.plot_id, lock=True)
    if plot.boundary is None:
        raise HTTPException(422, "Draw this field's outline in My fields first, so the satellite can find it")
    cycle = db.scalar(
        select(CropCycle)
        .where(CropCycle.plot_id == plot.id, CropCycle.status == "active")
        .order_by(CropCycle.sowing_date.desc())
        .limit(1)
    )
    if cycle is None:
        raise HTTPException(422, "Add the crop and sowing date for this field first")
    today = utcnow().date()
    operation = uuid4()
    centre = to_shape(plot.centroid)
    crop = BY_ID.get(cycle.crop_id or "")
    record.farmer_id, record.plot_id, record.accepted_at, record.status = farmer.id, plot.id, utcnow(), "processing"
    record.declared = {
        "crop_id": cycle.crop_id,
        "crop": crop["name"] if crop else cycle.crop,
        "sowing_date": cycle.sowing_date.isoformat(),
        "expected_harvest": cycle.expected_harvest.isoformat(),
        "entered_hectares": float(plot.entered_area_hectares) if plot.entered_area_hectares is not None else None,
        "mapped_hectares": round(float(plot.area_hectares), 3),
        "location": {"latitude": round(centre.y, 2), "longitude": round(centre.x, 2)},
        "boundary_revision": plot.revision,
        "satellite_operation": str(operation),
    }
    from remote_sensing.router import get_service

    if get_service().status()["status"] == "ready":
        start = max(cycle.sowing_date - timedelta(days=30), today - timedelta(days=180))
        db.add(
            Job(
                plot_id=plot.id,
                operation_id=operation,
                kind="satellite",
                payload={
                    "operation_id": str(operation),
                    "start_date": min(start, today).isoformat(),
                    "end_date": today.isoformat(),
                    "index": "ndvi",
                    "interval_days": 10,
                    "boundary_revision": plot.revision,
                },
            )
        )
        db.flush()
        schedule_drain(request, tasks)
    db.add(AuditLog(actor_id=farmer.id, action="verification_accepted", target_id=record.id))
    evaluate(db, record)
    return view(record, requester_name=db.get(Farmer, record.requester_id).display_name)


@router.get("/verifications/mine")
def mine(farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    rows = db.execute(
        select(Verification, Farmer.display_name)
        .join(Farmer, Verification.requester_id == Farmer.id)
        .where(Verification.farmer_id == farmer.id)
        .order_by(Verification.accepted_at.desc())
        .limit(50)
    ).all()
    for record, _ in rows:
        evaluate(db, record)
    return {"items": [view(record, requester_name=name) for record, name in rows]}


@router.delete("/verifications/{verification_id}")
def withdraw(verification_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    record = db.scalar(
        select(Verification)
        .where(Verification.id == verification_id, Verification.farmer_id == farmer.id)
        .with_for_update()
    )
    if record is None:
        raise HTTPException(404, "Verification not found")
    # The institution keeps only the fact that the farmer withdrew.
    record.status, record.declared, record.result = "withdrawn", {}, {}
    record.farmer_id = record.plot_id = None
    db.add(AuditLog(actor_id=farmer.id, action="verification_withdrawn", target_id=record.id))
    return {"status": "withdrawn"}
