"""Claim Kit: a crop-loss evidence pack a farmer can hand to a crop insurer.

One loss report holds what happened, geo-tagged photos taken in the field and,
where the field is mapped, the satellite view before and after. Krishyak does
not file claims or decide them; the pack only organises the farmer's own
evidence and repeats the official intimation routes.
"""

import hashlib
import json
from datetime import date, datetime, timedelta, timezone
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from geoalchemy2.shape import to_shape
from PIL import Image, UnidentifiedImageError
from pydantic import Field, field_validator
from sqlalchemy import func, select

from db.models import CropCycle, Farm, ImageAsset, ObjectDeletion, Observation, Plot, utcnow
from repositories.ownership import owned_plot

from .crops import BY_ID
from .providers import object_storage, sanitize_image
from .router import current_farmer, database, require_consent
from .schemas import Input, Number

router = APIRouter(prefix="/api/v2", tags=["Claim Kit"])
INDIA = timezone(timedelta(hours=5, minutes=30))
CAUSES = (
    "hailstorm",
    "flood",
    "heavy_rain",
    "drought",
    "pest_disease",
    "fire",
    "storm",
    "landslide",
    "rain_after_harvest",
    "other",
)
# PMFBY operational guidelines: these field-level events need the farmer's own
# intimation within 72 hours; widespread events are assessed for the whole area.
INDIVIDUAL_CAUSES = {"hailstorm", "flood", "landslide", "fire", "rain_after_harvest"}
MAX_PHOTOS = 8
OFFICIAL = {
    "helpline": "14447",
    "window_hours": 72,
    "routes": ["helpline", "crop_insurance_app", "insurer", "bank", "agriculture_office"],
    "portal": "https://pmfby.gov.in/",
    "source": "PMFBY Revamped Operational Guidelines; Krishi Rakshak Portal and Helpline 14447",
    "reviewed_at": "2026-11-12",
}


class LossInput(Input):
    operation_id: UUID
    cause: Literal[CAUSES]
    occurred_on: date
    affected_percent: Number = Field(gt=0, le=100)
    note: str = Field(default="", max_length=1000)

    @field_validator("occurred_on")
    @classmethod
    def recent(cls, value):
        today = datetime.now(INDIA).date()
        if not timedelta(0) <= today - value <= timedelta(days=60):
            raise ValueError("Choose a date in the last 60 days")
        return value


def owned_report(db, farmer, report_id, *, lock=False):
    query = (
        select(Observation)
        .join(Plot, Observation.plot_id == Plot.id)
        .join(Farm)
        .where(Observation.id == report_id, Observation.kind == "crop_loss", Farm.farmer_id == farmer.id)
    )
    report = db.scalar(query.with_for_update(of=Observation) if lock else query)
    if report is None or "claim" not in report.payload:
        raise HTTPException(404, "Loss report not found")
    return report


def photos_of(db, farmer, report_id):
    return db.scalars(
        select(ImageAsset)
        .where(ImageAsset.farmer_id == farmer.id, ImageAsset.result["report_id"].astext == str(report_id))
        .order_by(ImageAsset.created_at, ImageAsset.id)
    ).all()


def summary(report, photos):
    claim = report.payload["claim"]
    occurred = date.fromisoformat(claim["occurred_on"])
    deadline = datetime.combine(occurred, datetime.min.time(), INDIA) + timedelta(
        days=1, hours=OFFICIAL["window_hours"]
    )
    return {
        "id": report.id,
        "plot_id": report.plot_id,
        "created_at": report.created_at,
        **claim,
        "individual_intimation": claim["cause"] in INDIVIDUAL_CAUSES,
        # Counted from the end of the loss day, the latest the event can have ended.
        "intimation_hours_left": max(0, int((deadline - datetime.now(INDIA)).total_seconds() // 3600)),
        "photo_count": len(photos),
    }


@router.post("/plots/{plot_id}/loss-reports", status_code=201)
def create_report(
    plot_id: UUID, body: LossInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    owned_plot(db, farmer.id, plot_id, lock=True)
    cycle = db.scalar(
        select(CropCycle)
        .where(CropCycle.plot_id == plot_id, CropCycle.status.in_(["active", "completed"]))
        .order_by(CropCycle.sowing_date.desc())
        .limit(1)
    )
    claim = {
        "cause": body.cause,
        "occurred_on": body.occurred_on.isoformat(),
        "affected_percent": float(body.affected_percent),
        "crop_id": cycle.crop_id if cycle else None,
        "crop": cycle.crop if cycle else None,
        "sowing_date": cycle.sowing_date.isoformat() if cycle else None,
        "expected_harvest": cycle.expected_harvest.isoformat() if cycle else None,
    }
    payload = {
        "kind": "crop_loss",
        "note": body.note or "Crop loss reported",
        "measurements": {"loss_percent": float(body.affected_percent)},
        "unit": "%",
        "claim": claim,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    existing = db.scalar(
        select(Observation).where(Observation.plot_id == plot_id, Observation.operation_id == body.operation_id)
    )
    if existing:
        if existing.payload_hash != digest:
            raise HTTPException(409, "Operation ID already used for another report")
        return summary(existing, photos_of(db, farmer, existing.id))
    report = Observation(
        plot_id=plot_id,
        kind="crop_loss",
        observed_at=datetime.combine(body.occurred_on, datetime.min.time(), INDIA).astimezone(timezone.utc),
        source_type="farmer_entered",
        source="Farmer loss report",
        operation_id=body.operation_id,
        payload=payload,
        payload_hash=digest,
        provenance={"method": "manual entry", "limitations": ["Not independently verified"]},
    )
    db.add(report)
    db.flush()
    return summary(report, [])


@router.get("/plots/{plot_id}/loss-reports")
def reports(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    owned_plot(db, farmer.id, plot_id)
    rows = db.scalars(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "crop_loss", Observation.payload.has_key("claim"))
        .order_by(Observation.observed_at.desc())
        .limit(20)
    ).all()
    return {"items": [summary(row, photos_of(db, farmer, row.id)) for row in rows], "official": OFFICIAL}


@router.post("/loss-reports/{report_id}/photos", status_code=201)
def add_photo(
    report_id: UUID,
    request: Request,
    operation_id: UUID = Form(...),
    captured_at: datetime = Form(...),
    latitude: float | None = Form(default=None, ge=6, le=37.5),
    longitude: float | None = Form(default=None, ge=68, le=97.5),
    accuracy_metres: float | None = Form(default=None, ge=0, le=100000),
    image: UploadFile = File(...),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    report = owned_report(db, farmer, report_id, lock=True)
    if (latitude is None) != (longitude is None):
        raise HTTPException(422, "Send both coordinates or neither")
    if latitude is not None:
        require_consent(db, farmer, "location_processing")
    now = utcnow()
    if captured_at.tzinfo is None or not now - timedelta(days=60) <= captured_at <= now + timedelta(minutes=2):
        raise HTTPException(422, "Photo time must be recent and include a time zone")
    try:
        clean, width, height, digest = sanitize_image(image.file.read(8 * 1024 * 1024 + 1), image.content_type)
    except (ValueError, UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise HTTPException(422, "Use a valid JPEG, PNG or WebP photograph") from None
    finally:
        image.file.close()
    existing = db.scalar(
        select(ImageAsset).where(ImageAsset.farmer_id == farmer.id, ImageAsset.operation_id == operation_id)
    )
    if existing:
        if existing.sha256 != digest or existing.result.get("report_id") != str(report_id):
            raise HTTPException(409, "Operation ID already used for another photograph")
        return photo_view(existing)
    if len(photos_of(db, farmer, report_id)) >= MAX_PHOTOS:
        raise HTTPException(422, f"A loss report holds at most {MAX_PHOTOS} photographs")
    request.app.state.v2_quotas.check("loss_photos", str(farmer.id), 24, 3600)
    request.app.state.v2_quotas.check("images_global", "global", 2000, 86400)
    plot = db.get(Plot, report.plot_id)
    place = plot.centroid if plot.centroid is not None else plot.approximate_location
    distance = None
    if latitude is not None and place is not None:
        centre = to_shape(place)
        distance = db.scalar(
            select(
                func.ST_Distance(
                    func.geography(func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)),
                    func.geography(func.ST_SetSRID(func.ST_MakePoint(centre.x, centre.y), 4326)),
                )
            )
        )
    object_key = f"{farmer.id}/{uuid4()}.jpg"
    cleanup = ObjectDeletion(object_key=object_key, available_at=now + timedelta(hours=1))
    db.add(cleanup)
    db.flush()
    try:
        object_storage(request.app.state.v2_settings).put(object_key, clean)
    except Exception:
        raise HTTPException(503, "Photo storage unavailable; retry later") from None
    asset = ImageAsset(
        farmer_id=farmer.id,
        plot_id=report.plot_id,
        object_key=object_key,
        sha256=digest,
        mime="image/jpeg",
        width=width,
        height=height,
        operation_id=operation_id,
        result={
            "status": "evidence",
            "kind": "loss_photo",
            "report_id": str(report_id),
            "captured_at": captured_at.astimezone(timezone.utc).isoformat(),
            # Device-reported; photo metadata is stripped and never trusted.
            "location": {
                "latitude": round(latitude, 5),
                "longitude": round(longitude, 5),
                "accuracy_metres": accuracy_metres,
            }
            if latitude is not None
            else None,
            "distance_to_field_metres": round(distance) if distance is not None else None,
        },
    )
    db.add(asset)
    db.delete(cleanup)
    db.flush()
    return photo_view(asset)


def photo_view(asset):
    return {
        "id": asset.id,
        "sha256": asset.sha256,
        "uploaded_at": asset.created_at,
        **{key: asset.result.get(key) for key in ("captured_at", "location", "distance_to_field_metres")},
    }


def satellite_change(db, plot, occurred):
    """Latest clear NDVI view before the loss day and the first clear one after."""
    if plot.boundary is None:
        return {"status": "needs_boundary"}
    rows = db.scalars(
        select(Observation)
        .where(Observation.plot_id == plot.id, Observation.kind == "remote_sensing")
        .order_by(Observation.observed_at)
        .limit(200)
    ).all()
    clear = [
        row.payload["observation"]
        for row in rows
        if row.payload.get("index") == "ndvi"
        and row.payload["observation"].get("quality_status") == "clear"
        and row.provenance.get("boundary_revision") == plot.revision
    ]
    before = [x for x in clear if date.fromisoformat(x["end"][:10]) < occurred]
    after = [x for x in clear if date.fromisoformat(x["start"][:10]) > occurred]
    if not before or not after:
        return {"status": "waiting_for_clear_view" if before else "no_view_before", "source": "Sentinel-2 L2A"}
    first, last = before[-1], after[0]
    return {
        "status": "available",
        "index": "ndvi",
        "before": {"from": first["start"][:10], "to": first["end"][:10], "mean": round(first["mean"], 3)},
        "after": {"from": last["start"][:10], "to": last["end"][:10], "mean": round(last["mean"], 3)},
        "change": round(last["mean"] - first["mean"], 3),
        "source": "Sentinel-2 L2A, field average of clear pixels",
        "limitations": [
            "Crop greenness also falls at harvest and ripening",
            "A satellite index cannot show the cause of damage",
        ],
    }


@router.get("/loss-reports/{report_id}")
def claim_kit(report_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    report = owned_report(db, farmer, report_id)
    plot = owned_plot(db, farmer.id, report.plot_id)
    photos = photos_of(db, farmer, report.id)
    claim = report.payload["claim"]
    area = plot.area_hectares if plot.area_hectares is not None else plot.entered_area_hectares
    place = plot.centroid if plot.centroid is not None else plot.approximate_location
    point = to_shape(place) if place is not None else None
    crop = BY_ID.get(claim.get("crop_id") or "")
    return {
        "report": summary(report, photos) | {"note": report.payload["note"]},
        "farmer": {
            "name": farmer.display_name,
            "village": farmer.village,
            "district": farmer.district,
            "state": farmer.state,
            "mobile": farmer.mobile or farmer.contact_mobile,
        },
        "field": {
            "name": plot.name,
            "area_hectares": round(float(area), 3) if area is not None else None,
            "mapped": plot.boundary is not None,
            "location": {"latitude": round(point.y, 4), "longitude": round(point.x, 4)} if point else None,
            "irrigation": plot.irrigation_type,
        },
        "crop": {
            "crop_id": claim.get("crop_id"),
            "name": crop["name"] if crop else claim.get("crop"),
            "sowing_date": claim.get("sowing_date"),
            "expected_harvest": claim.get("expected_harvest"),
        },
        "photos": [photo_view(photo) for photo in photos],
        "satellite": satellite_change(db, plot, date.fromisoformat(claim["occurred_on"])),
        "official": OFFICIAL,
        "generated_at": utcnow(),
        "limitations": [
            "Prepared by the farmer with Krishyak; not verified by Krishyak, an insurer or the government",
            "Photo place and time come from the farmer's phone",
            "Only the insurer decides a claim under the scheme rules",
        ],
    }


@router.delete("/loss-reports/{report_id}")
def delete_report(report_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    report = owned_report(db, farmer, report_id, lock=True)
    for photo in photos_of(db, farmer, report.id):
        db.add(ObjectDeletion(object_key=photo.object_key))
        db.delete(photo)
    db.delete(report)
    return {"status": "deleted", "object_cleanup": "queued"}
