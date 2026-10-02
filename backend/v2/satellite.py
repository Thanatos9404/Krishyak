"""Owner-scoped scheduled ingestion, independent from public GIS requests."""

from datetime import date, datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response
from geoalchemy2.shape import to_shape
from pydantic import Field, model_validator
from shapely.geometry import mapping
from sqlalchemy import select

from db.models import CropCycle, Job, Observation
from remote_sensing.providers.base import ProviderError
from remote_sensing.schemas import PreviewRequest
from repositories.ownership import owned_plot

from .evidence import compose_today
from .router import current_farmer, database, require_consent, serialize
from .schemas import Input

router = APIRouter(prefix="/api/v2", tags=["Plot evidence"])


class SatelliteRefresh(Input):
    operation_id: UUID
    start_date: date = Field(default_factory=lambda: datetime.now(timezone.utc).date() - timedelta(days=90))
    end_date: date = Field(default_factory=lambda: datetime.now(timezone.utc).date())
    index: Literal["ndvi", "ndmi", "ndre"] = "ndvi"
    interval_days: Literal[5, 10] = 10

    @model_validator(mode="after")
    def ordered(self):
        if not 0 <= (self.end_date - self.start_date).days <= 180 or self.end_date > datetime.now(timezone.utc).date():
            raise ValueError("Use an ordered historical date range of at most 180 days")
        return self


class PreviewInput(Input):
    date: date
    layer: Literal["ndvi", "ndmi", "ndre", "true_color"] = "ndvi"

    @model_validator(mode="after")
    def historical(self):
        if not 0 <= (datetime.now(timezone.utc).date() - self.date).days <= 180:
            raise ValueError("Preview date must be within the last 180 days")
        return self


@router.post("/plots/{plot_id}/remote-sensing/preview")
def preview(
    plot_id: UUID,
    body: PreviewInput,
    request: Request,
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    plot = owned_plot(db, farmer.id, plot_id)
    require_consent(db, farmer, "location_processing")
    require_consent(db, farmer, "satellite_processing")
    if plot.boundary is None:
        raise HTTPException(422, "Map a field boundary before requesting imagery")
    request.app.state.v2_quotas.check("satellite_preview", str(farmer.id), 6, 3600)
    from remote_sensing.router import get_service

    service = get_service()
    query = PreviewRequest(
        geometry=mapping(to_shape(plot.boundary)),
        start_date=body.date,
        end_date=body.date,
        layer=body.layer,
        width=512,
        height=512,
    )
    try:
        payload, _ = service.execute("preview", query, f"owner:{farmer.id}")
    except ProviderError as error:
        raise HTTPException(error.status, error.message) from None
    except ValueError:
        raise HTTPException(422, "Field extent exceeds supported satellite processing limits") from None
    # The response is private; the persisted polygon is never caller supplied.
    return Response(content=payload, media_type="image/png", headers={"Cache-Control": "no-store"})


@router.post("/plots/{plot_id}/remote-sensing/refresh", status_code=202)
def refresh(
    plot_id: UUID,
    body: SatelliteRefresh,
    request: Request,
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    plot = owned_plot(db, farmer.id, plot_id, lock=True)
    require_consent(db, farmer, "location_processing")
    require_consent(db, farmer, "satellite_processing")
    if plot.boundary is None:
        raise HTTPException(422, "Draw an approximate field boundary before satellite analysis")
    payload = body.model_dump(mode="json") | {"boundary_revision": plot.revision}
    job = db.scalar(select(Job).where(Job.plot_id == plot_id, Job.operation_id == body.operation_id))
    if job:
        if job.payload != payload:
            raise HTTPException(409, "Operation ID already used for another satellite request")
        return serialize(job)
    from remote_sensing.router import get_service

    if get_service().status()["status"] != "ready":
        raise HTTPException(503, "Satellite observations are unavailable. You can still record field observations.")
    request.app.state.v2_quotas.check("satellite", str(farmer.id), 6, 3600)
    job = Job(plot_id=plot_id, operation_id=body.operation_id, kind="satellite", payload=payload)
    db.add(job)
    db.flush()
    return serialize(job)


@router.get("/plots/{plot_id}/remote-sensing")
def observations(
    plot_id: UUID,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(36, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    plot = owned_plot(db, farmer.id, plot_id)
    records = db.scalars(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "remote_sensing")
        .order_by(Observation.observed_at.desc(), Observation.id)
        .offset(offset)
        .limit(limit)
    ).all()
    job = db.scalar(select(Job).where(Job.plot_id == plot_id).order_by(Job.created_at.desc()).limit(1))
    return {
        "items": [serialize(x, exclude=("payload_hash",)) for x in records],
        "boundary_revision": plot.revision,
        "status": "available" if records else "unavailable",
        "latest_job": serialize(job) if job else None,
    }


@router.get("/plots/{plot_id}/today")
def today(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    plot = owned_plot(db, farmer.id, plot_id)
    rows = db.scalars(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "remote_sensing")
        .order_by(Observation.observed_at.desc())
        .limit(100)
    ).all()
    last_report = db.scalar(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "farmer_observation")
        .order_by(Observation.observed_at.desc())
        .limit(1)
    )
    weather = db.scalar(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "weather")
        .order_by(Observation.created_at.desc())
        .limit(1)
    )
    soil = db.scalar(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "soil")
        .order_by(Observation.observed_at.desc())
        .limit(1)
    )
    cycle = db.scalar(
        select(CropCycle)
        .where(CropCycle.plot_id == plot_id, CropCycle.status == "active")
        .order_by(CropCycle.sowing_date.desc())
        .limit(1)
    )
    return compose_today(plot, rows, last_report, weather, soil, cycle)
