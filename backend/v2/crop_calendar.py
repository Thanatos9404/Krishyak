"""Crop calendar: what a crop usually needs this week, counted from sowing.

Stage windows follow the general ICAR and state agricultural university
packages of practices. They are reminders about water, weeding and harvest
timing only: no fertilizer or chemical amounts. Local advice and the weather
always come first, and the calendar says so.
"""

from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select

from db.models import CropCycle, utcnow
from repositories.ownership import owned_plot

from .router import current_farmer, database

router = APIRouter(prefix="/api/v2", tags=["Crop calendar"])
INDIA_OFFSET = timedelta(hours=5, minutes=30)
META = {
    "review_status": "draft_needs_agronomist_review",
    "source": "General ICAR and state agricultural university packages of practices",
    "counted_from": {"rice": "transplanting"},
}

# crop: [(first day, last day, kind, task)], days after sowing (rice: after transplanting).
CALENDAR = {
    "wheat": [
        (20, 25, "water", "First watering now. It is the most important one for wheat: roots are forming."),
        (30, 35, "weed", "Remove weeds once now, while they are small."),
        (40, 45, "water", "Second watering: the plants are making side shoots."),
        (60, 65, "water", "Water now: the stems are growing fast."),
        (80, 85, "water", "Water at flowering. Do not let the field dry out this week."),
        (100, 105, "water", "Water once while the grains are milky."),
        (115, 120, "water", "Last light watering. Stop watering after this so the crop can dry."),
        (125, 140, "harvest", "Harvest when the grain is hard and the straw is golden and dry."),
    ],
    "mustard": [
        (15, 20, "thin", "Thin the plants so each has a hand's width of space."),
        (20, 25, "weed", "Remove weeds once now."),
        (30, 35, "water", "First watering, just before flowering."),
        (45, 60, "watch", "Flowering: look under leaves and on shoots for aphids twice a week."),
        (60, 70, "water", "Second watering while pods are forming."),
        (110, 140, "harvest", "Harvest when three out of four pods have turned golden."),
    ],
    "chickpea": [
        (25, 30, "weed", "Remove weeds once now."),
        (30, 40, "thin", "Pinch off the top shoots to get more branches."),
        (45, 60, "water", "One watering before flowering, only if there has been no winter rain."),
        (60, 75, "watch", "Flowering: do not water now. Look for pod borer caterpillars."),
        (75, 90, "water", "One light watering while pods fill, only if the soil is dry."),
        (100, 120, "harvest", "Harvest when leaves turn reddish brown and start to drop."),
    ],
    "maize": [
        (15, 20, "weed", "Remove weeds now, while the maize is small."),
        (30, 35, "water", "Knee-high stage: water, weed again and heap soil around the stems."),
        (50, 65, "water", "Tassels and silks are coming. Never let the field dry out now."),
        (75, 90, "water", "Water while the grains fill."),
        (95, 110, "harvest", "Harvest when the husk is dry and the grains are hard."),
    ],
    "bajra": [
        (15, 20, "thin", "Fill gaps and thin crowded plants now."),
        (20, 25, "weed", "Remove weeds once now."),
        (30, 35, "water", "Water once now if there has been no rain."),
        (45, 55, "water", "Flowering: water if the soil is dry."),
        (60, 70, "water", "Grain filling: water if the soil is dry."),
        (75, 90, "harvest", "Harvest when the grains are hard and the ear heads look dry."),
    ],
    "cotton": [
        (15, 20, "thin", "Keep one or two healthy plants at each spot and remove the rest."),
        (20, 30, "weed", "Remove weeds now."),
        (45, 60, "weed", "Weed again and heap soil around the plants."),
        (
            60,
            120,
            "water",
            "Flowers and bolls are forming. Do not let the crop face a dry spell, and drain standing water.",
        ),
        (60, 120, "watch", "Check ten plants every week for whitefly and bollworm, and use traps to watch them."),
        (120, 170, "harvest", "Pick only fully opened, dry bolls, in the morning after the dew has gone."),
    ],
    "soybean": [
        (20, 25, "weed", "Remove weeds now."),
        (40, 45, "weed", "Weed once more before the crop closes over."),
        (40, 50, "water", "Flowering: water if there is a dry spell, and drain standing water."),
        (60, 80, "water", "Pods are filling. Water if the soil is dry."),
        (95, 110, "harvest", "Harvest when nine out of ten pods have turned brown."),
    ],
    "rice": [
        (0, 10, "water", "Keep shallow water, two to three fingers deep, so the seedlings settle."),
        (20, 25, "weed", "Remove weeds now."),
        (40, 45, "weed", "Weed once more. This is when the plant makes the most shoots."),
        (55, 65, "water", "The ear is forming inside the stem. Never let the field dry out now."),
        (85, 95, "water", "Flowering: keep water in the field."),
        (100, 110, "water", "Drain the field about two weeks before harvest."),
        (115, 130, "harvest", "Harvest when most of the grains on the ear have turned golden."),
    ],
}


def calendar_for(crop_id, sowing_date, today=None):
    """Stages with their dates and whether each is past, due now or coming."""
    stages = CALENDAR.get(crop_id)
    if not stages:
        return None
    today = today or (utcnow() + INDIA_OFFSET).date()
    day = (today - sowing_date).days
    rows = []
    for first, last, kind, task in stages:
        rows.append(
            {
                "kind": kind,
                "task": task,
                "from": (sowing_date + timedelta(days=first)).isoformat(),
                "to": (sowing_date + timedelta(days=last)).isoformat(),
                "status": "done" if day > last else "now" if day >= first else "next",
                "in_days": max(0, first - day),
            }
        )
    return {
        "crop_id": crop_id,
        "day": day,
        "counted_from": META["counted_from"].get(crop_id, "sowing"),
        "now": [row for row in rows if row["status"] == "now"],
        "next": next((row for row in rows if row["status"] == "next"), None),
        "stages": rows,
        "review_status": META["review_status"],
        "source": META["source"],
    }


@router.get("/plots/{plot_id}/calendar")
def crop_calendar(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    plot = owned_plot(db, farmer.id, plot_id)
    cycle = db.scalar(
        select(CropCycle)
        .where(CropCycle.plot_id == plot.id, CropCycle.status.in_(["active", "planned"]))
        .order_by(CropCycle.sowing_date.desc())
        .limit(1)
    )
    result = calendar_for(cycle.crop_id, cycle.sowing_date) if cycle else None
    if result is None:
        return {"status": "needs_crop" if cycle is None else "crop_not_covered", "covered_crops": sorted(CALENDAR)}
    return {"status": "available"} | result
