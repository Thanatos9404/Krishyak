"""Pest Radar: early, anonymous warnings when a disease is spreading nearby.

A warning appears for a field when photo checks from at least three other
farmers within 10 km found the same disease on the same crop in the last 14
days. Only farmers who chose to share (the ``community_alerts`` consent) are
counted, and a warning carries no names, places, photos or exact counts.
"""

from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from geoalchemy2.shape import to_shape
from sqlalchemy import and_, func, select

from db.models import Consent, CropCycle, ImageAsset, Plot, utcnow
from repositories.ownership import owned_plot

from .images import GUIDANCE
from .router import current_farmer, database

router = APIRouter(prefix="/api/v2", tags=["Pest Radar"])
RADIUS_METRES = 10_000
WINDOW_DAYS = 14
MINIMUM_FARMS = 3  # Fewer could point at one family's field.
BUCKETS = (10, 5, 3)


def has_consent(db, farmer_id, purpose):
    return (
        db.scalar(
            select(Consent.id).where(
                Consent.farmer_id == farmer_id, Consent.purpose == purpose, Consent.withdrawn_at.is_(None)
            )
        )
        is not None
    )


def field_crop(db, plot_id):
    cycle = db.scalar(
        select(CropCycle)
        .where(CropCycle.plot_id == plot_id, CropCycle.status.in_(["active", "planned"]))
        .order_by(CropCycle.sowing_date.desc())
        .limit(1)
    )
    return cycle.crop_id if cycle else None


def alerts_for(db, plot, farmer_id, crop_id, now=None):
    """Diseases other consenting farmers nearby found on the same crop."""
    origin = plot.centroid if plot.centroid is not None else plot.approximate_location
    if origin is None or not crop_id:
        return []
    now = now or utcnow()
    here = to_shape(origin)
    centre = func.geography(func.ST_SetSRID(func.ST_MakePoint(here.x, here.y), 4326))
    place = func.coalesce(Plot.centroid, Plot.approximate_location)
    rows = db.execute(
        select(ImageAsset.farmer_id, ImageAsset.result["predicted_class"].astext, ImageAsset.created_at)
        .join(Plot, ImageAsset.plot_id == Plot.id)
        .join(
            Consent,
            and_(
                Consent.farmer_id == ImageAsset.farmer_id,
                Consent.purpose == "community_alerts",
                Consent.withdrawn_at.is_(None),
            ),
        )
        .where(
            ImageAsset.farmer_id != farmer_id,
            ImageAsset.created_at >= now - timedelta(days=WINDOW_DAYS),
            ImageAsset.result["status"].astext == "detected",
            ImageAsset.result["crop_id"].astext == crop_id,
            place.is_not(None),
            func.ST_DWithin(func.geography(place), centre, RADIUS_METRES),
        )
        .limit(2000)
    ).all()
    found = {}
    for owner, label, seen in rows:
        if label in GUIDANCE["classes"]:
            entry = found.setdefault(label, {"farms": set(), "recent": set(), "latest": seen})
            entry["farms"].add(owner)
            entry["latest"] = max(entry["latest"], seen)
            if seen >= now - timedelta(days=7):
                entry["recent"].add(owner)
    alerts = []
    for label, entry in found.items():
        farms = len(entry["farms"])
        if farms < MINIMUM_FARMS:
            continue
        guide = GUIDANCE["classes"][label]
        alerts.append(
            {
                "disease": label,
                "name": guide["name"],
                "cause": guide["cause"],
                "urgent": bool(guide.get("urgent")),
                # A lower bound only: exact counts could identify a village.
                "farms_at_least": next(bound for bound in BUCKETS if farms >= bound),
                "days_since_latest": max(0, (now - entry["latest"]).days),
                "rising": len(entry["recent"]) > farms - len(entry["recent"]),
                "steps": guide["steps"],
            }
        )
    return sorted(alerts, key=lambda row: (-row["urgent"], -row["farms_at_least"], row["days_since_latest"]))


@router.get("/plots/{plot_id}/pest-radar")
def pest_radar(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    plot = owned_plot(db, farmer.id, plot_id)
    crop_id = field_crop(db, plot.id)
    located = plot.centroid is not None or plot.approximate_location is not None
    allowed = has_consent(db, farmer.id, "location_processing")
    status = (
        "needs_location"
        if not located
        else "needs_permission"
        if not allowed
        else "needs_crop"
        if not crop_id
        else "watching"
    )
    alerts = alerts_for(db, plot, farmer.id, crop_id) if status == "watching" else []
    return {
        "status": "alert" if alerts else status,
        "crop_id": crop_id,
        "alerts": alerts,
        "sharing": has_consent(db, farmer.id, "community_alerts"),
        "radius_km": RADIUS_METRES // 1000,
        "window_days": WINDOW_DAYS,
        "minimum_farms": MINIMUM_FARMS,
        "limitations": [
            "Based on photo checks by nearby farmers who chose to share; it is not a field survey",
            "A photo check is a suggestion, not a diagnosis",
        ],
    }
