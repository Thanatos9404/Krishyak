"""FPO Command Centre: member fields that farmers chose to share with their group.

A farmer joins by entering the group's code and picking fields. The group's
organiser then sees, for those fields only: the farmer's name and village, crop,
area, the latest photo-check result, satellite vigour, nearby disease alerts and
loss reports. Never phone numbers, field outlines, notes or photographs.
"""

import secrets
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import Field
from sqlalchemy import func, select

from db.models import (
    AuditLog,
    Consent,
    CropCycle,
    Farm,
    Farmer,
    ImageAsset,
    Observation,
    PilotCohort,
    PilotEnrollment,
    Plot,
    utcnow,
)
from repositories.ownership import owned_plot

from .auth import authenticate
from .crops import BY_ID
from .radar import alerts_for
from .router import current_farmer, database, require_consent, serialize
from .schemas import Input

router = APIRouter(prefix="/api/v2", tags=["Farmer groups"])
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # no look-alike letters or digits
MAX_FIELDS = 400
SHARED = [
    "Your name and village",
    "The fields you pick: name, crop, area and sowing date",
    "Latest photo-check result, satellite greenness, nearby disease alerts and loss reports for those fields",
]
NEVER_SHARED = ["Phone number", "Field outline or exact location", "Photographs", "Notes, costs and sales"]


def new_code():
    return "".join(secrets.choice(ALPHABET) for _ in range(8))


def organiser(farmer, request, db, *, fresh_minutes):
    if farmer.role not in {"organisation_admin", "admin"}:
        raise HTTPException(403, "Institutional role required")
    _, session = authenticate(db, request)
    if session.authenticated_at < utcnow() - timedelta(minutes=fresh_minutes):
        raise HTTPException(401, "Sign in again to continue")


def own_group(db, farmer, group_id):
    group = db.scalar(
        select(PilotCohort).where(
            PilotCohort.id == group_id, PilotCohort.organisation_admin_id == farmer.id, PilotCohort.kind == "fpo"
        )
    )
    if group is None:
        raise HTTPException(404, "Group not found")
    return group


def active_members(group_id):
    return (
        select(PilotEnrollment, Farmer)
        .join(Farmer, PilotEnrollment.farmer_id == Farmer.id)
        .join(Consent, PilotEnrollment.consent_id == Consent.id)
        .where(
            PilotEnrollment.cohort_id == group_id,
            PilotEnrollment.withdrawn_at.is_(None),
            Consent.withdrawn_at.is_(None),
            Consent.purpose == "organisation_sharing",
        )
    )


class GroupInput(Input):
    name: str = Field(min_length=2, max_length=100)
    district: str = Field(min_length=2, max_length=100)


class JoinInput(Input):
    code: str = Field(min_length=8, max_length=12, pattern="^[A-Za-z0-9]+$")
    plot_ids: list[UUID] = Field(min_length=1, max_length=50)


@router.post("/admin/groups", status_code=201)
def create_group(
    body: GroupInput, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    organiser(farmer, request, db, fresh_minutes=10)
    owned = db.scalar(
        select(func.count()).select_from(PilotCohort).where(PilotCohort.organisation_admin_id == farmer.id)
    )
    if owned >= 50:
        raise HTTPException(422, "Maximum groups reached")
    group = PilotCohort(
        organisation_admin_id=farmer.id,
        name=body.name,
        district=body.district,
        crops=[],
        status="active",
        kind="fpo",
        join_code=new_code(),
    )
    db.add(group)
    db.flush()
    db.add(AuditLog(actor_id=farmer.id, action="group_created", target_id=group.id))
    return serialize(group)


@router.get("/admin/groups")
def groups(request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    organiser(farmer, request, db, fresh_minutes=720)
    rows = db.scalars(
        select(PilotCohort)
        .where(PilotCohort.organisation_admin_id == farmer.id, PilotCohort.kind == "fpo")
        .order_by(PilotCohort.created_at.desc())
        .limit(50)
    ).all()
    return {
        "items": [
            serialize(row) | {"members": db.scalar(select(func.count()).select_from(active_members(row.id).subquery()))}
            for row in rows
        ]
    }


def field_rows(db, members, now):
    """One row per shared field, read in bulk rather than per field."""
    wanted = {UUID(plot_id): farmer for enrollment, farmer in members for plot_id in enrollment.plot_ids[:50]}
    plots = db.execute(select(Plot, Farm.farmer_id).join(Farm).where(Plot.id.in_(list(wanted)[:MAX_FIELDS]))).all()
    # A field moved to another account is no longer the sharer's to show.
    plots = [plot for plot, owner in plots if wanted[plot.id].id == owner]
    ids = [plot.id for plot in plots]
    cycles = {}
    for cycle in db.scalars(
        select(CropCycle)
        .where(CropCycle.plot_id.in_(ids), CropCycle.status.in_(["active", "planned"]))
        .order_by(CropCycle.sowing_date)
    ):
        cycles[cycle.plot_id] = cycle
    checks = {}
    for image in db.scalars(
        select(ImageAsset)
        .where(
            ImageAsset.plot_id.in_(ids),
            ImageAsset.result["kind"].astext.is_(None),
            ImageAsset.created_at >= now - timedelta(days=60),
        )
        .order_by(ImageAsset.created_at)
    ):
        checks[image.plot_id] = image
    vigour, losses = {}, {}
    for row in db.scalars(
        select(Observation)
        .where(
            Observation.plot_id.in_(ids),
            Observation.kind.in_(["remote_sensing", "crop_loss"]),
            Observation.observed_at >= now - timedelta(days=60),
        )
        .order_by(Observation.observed_at)
    ):
        if row.kind == "crop_loss":
            if "claim" in row.payload:
                losses[row.plot_id] = row
        elif row.payload.get("index") == "ndvi" and row.payload["observation"].get("quality_status") == "clear":
            vigour[row.plot_id] = row
    rows = []
    for plot in sorted(plots, key=lambda item: (wanted[item.id].display_name.casefold(), item.name.casefold())):
        owner, cycle, check = wanted[plot.id], cycles.get(plot.id), checks.get(plot.id)
        area = plot.area_hectares if plot.area_hectares is not None else plot.entered_area_hectares
        crop = BY_ID.get(cycle.crop_id or "") if cycle else None
        alerts = alerts_for(db, plot, owner.id, cycle.crop_id if cycle else None, now) if len(rows) < 120 else []
        satellite, loss = vigour.get(plot.id), losses.get(plot.id)
        rows.append(
            {
                "farmer": owner.display_name,
                "village": owner.village,
                "field": plot.name,
                "area_hectares": round(float(area), 2) if area is not None else None,
                "crop_id": cycle.crop_id if cycle else None,
                "crop": crop["name"] if crop else (cycle.crop if cycle else None),
                "sowing_date": cycle.sowing_date if cycle else None,
                "photo_check": {
                    "date": check.created_at.date(),
                    "status": check.result.get("status"),
                    "likely_problem": (check.result.get("guidance") or {}).get("name"),
                }
                if check
                else None,
                "satellite": {
                    "date": satellite.observed_at.date(),
                    "ndvi": round(satellite.payload["observation"]["mean"], 2),
                }
                if satellite
                else None,
                "mapped": plot.boundary is not None,
                "nearby_alerts": [alert["name"] for alert in alerts],
                "loss_report": {
                    "date": loss.payload["claim"]["occurred_on"],
                    "cause": loss.payload["claim"]["cause"],
                    "affected_percent": loss.payload["claim"]["affected_percent"],
                }
                if loss
                else None,
            }
        )
    return rows


@router.get("/admin/groups/{group_id}/dashboard")
def dashboard(group_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    organiser(farmer, request, db, fresh_minutes=720)
    group = own_group(db, farmer, group_id)
    now = utcnow()
    members = db.execute(active_members(group.id).limit(500)).all()
    rows = field_rows(db, members, now)
    crops = {}
    for row in rows:
        if row["crop"]:
            entry = crops.setdefault(row["crop"], {"fields": 0, "hectares": 0.0})
            entry["fields"] += 1
            entry["hectares"] = round(entry["hectares"] + (row["area_hectares"] or 0), 2)
    attention = [
        row
        for row in rows
        if (row["photo_check"] and row["photo_check"]["status"] == "detected")
        or row["nearby_alerts"]
        or row["loss_report"]
    ]
    db.add(AuditLog(actor_id=farmer.id, action="group_dashboard_viewed", target_id=group.id))
    return {
        "group": {"id": group.id, "name": group.name, "district": group.district, "join_code": group.join_code},
        "totals": {
            "members": len(members),
            "fields": len(rows),
            "hectares": round(sum(row["area_hectares"] or 0 for row in rows), 2),
            "need_attention": len(attention),
            "photo_checks_60_days": sum(1 for row in rows if row["photo_check"]),
            "mapped_fields": sum(1 for row in rows if row["mapped"]),
        },
        "crops": crops,
        "fields": rows,
        "generated_at": now,
        "shared_by_members": SHARED,
        "never_shared": NEVER_SHARED,
    }


@router.get("/groups/lookup")
def lookup(
    request: Request,
    code: str = Query(min_length=8, max_length=12, pattern="^[A-Za-z0-9]+$"),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    # Codes are guessable only by brute force; bound attempts per account.
    request.app.state.v2_quotas.check("group_lookup", str(farmer.id), 20, 3600)
    row = db.execute(
        select(PilotCohort, Farmer.display_name)
        .join(Farmer, PilotCohort.organisation_admin_id == Farmer.id)
        .where(PilotCohort.join_code == code.upper(), PilotCohort.kind == "fpo", PilotCohort.status == "active")
    ).first()
    if row is None:
        raise HTTPException(404, "No group has this code. Check it with your group.")
    group, organiser_name = row
    return {
        "name": group.name,
        "district": group.district,
        "organiser": organiser_name,
        "shared": SHARED,
        "never_shared": NEVER_SHARED,
    }


@router.post("/groups/join", status_code=201)
def join(body: JoinInput, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    consent = require_consent(db, farmer, "organisation_sharing")
    request.app.state.v2_quotas.check("group_lookup", str(farmer.id), 20, 3600)
    group = db.scalar(
        select(PilotCohort).where(
            PilotCohort.join_code == body.code.upper(), PilotCohort.kind == "fpo", PilotCohort.status == "active"
        )
    )
    if group is None:
        raise HTTPException(404, "No group has this code. Check it with your group.")
    for plot_id in body.plot_ids:
        owned_plot(db, farmer.id, plot_id)
    ids = sorted(set(map(str, body.plot_ids)))
    record = db.scalar(
        select(PilotEnrollment).where(PilotEnrollment.cohort_id == group.id, PilotEnrollment.farmer_id == farmer.id)
    )
    if record is None:
        record = PilotEnrollment(cohort_id=group.id, farmer_id=farmer.id, consent_id=consent.id, plot_ids=ids)
        db.add(record)
    else:
        record.consent_id, record.withdrawn_at, record.plot_ids = consent.id, None, ids
    db.flush()
    db.add(AuditLog(actor_id=farmer.id, action="group_joined", target_id=group.id))
    return {"id": record.id, "name": group.name, "district": group.district, "plot_ids": ids}


@router.get("/groups/mine")
def mine(farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    rows = db.execute(
        select(PilotEnrollment, PilotCohort)
        .join(PilotCohort, PilotEnrollment.cohort_id == PilotCohort.id)
        .where(
            PilotEnrollment.farmer_id == farmer.id,
            PilotEnrollment.withdrawn_at.is_(None),
            PilotCohort.kind == "fpo",
        )
        .limit(50)
    ).all()
    return {
        "items": [
            {"id": enrollment.id, "name": group.name, "district": group.district, "plot_ids": enrollment.plot_ids}
            for enrollment, group in rows
        ],
        "shared": SHARED,
        "never_shared": NEVER_SHARED,
    }
