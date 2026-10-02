"""Persist measured soil and coarse-area weather with separate provenance."""

import asyncio
import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from geoalchemy2.shape import to_shape
from pydantic import Field, model_validator
from sqlalchemy import select

from db.models import Observation, utcnow
from repositories.ownership import owned_plot

from .auth import authenticate
from .router import current_farmer, database, require_consent, serialize
from .schemas import Input, Number, ObservationInput

router = APIRouter(prefix="/api/v2", tags=["Plot weather and soil"])


class SoilMeasurement(Input):
    parameter: Literal["ph", "nitrogen", "phosphorus", "potassium", "organic_carbon", "moisture", "conductivity"]
    value: Number = Field(ge=0, le=1000000)
    unit: Literal["pH", "mg/kg", "kg/ha", "%", "dS/m"]
    depth_cm: Number | None = Field(default=None, ge=0, le=200)

    @model_validator(mode="after")
    def units(self):
        allowed = {
            "ph": {"pH"},
            "nitrogen": {"mg/kg", "kg/ha"},
            "phosphorus": {"mg/kg", "kg/ha"},
            "potassium": {"mg/kg", "kg/ha"},
            "organic_carbon": {"%"},
            "moisture": {"%"},
            "conductivity": {"dS/m"},
        }
        if (
            self.unit not in allowed[self.parameter]
            or self.unit == "pH"
            and self.value > 14
            or self.unit == "%"
            and self.value > 100
        ):
            raise ValueError("Value or unit is invalid for this soil parameter")
        return self


class SoilInput(Input):
    operation_id: UUID
    observed_at: datetime
    source: str = Field(min_length=1, max_length=100)
    reported_method: Literal["lab_report", "soil_card", "sensor_reading", "manual_estimate"]
    measurements: list[SoilMeasurement] = Field(min_length=1, max_length=12)
    note: str = Field(default="Farmer entered soil evidence", max_length=2000)

    @model_validator(mode="after")
    def valid(self):
        ObservationInput(operation_id=self.operation_id, observed_at=self.observed_at, kind="soil", note=self.note)
        if len({(x.parameter, x.depth_cm) for x in self.measurements}) != len(self.measurements):
            raise ValueError("Duplicate soil parameter and depth")
        return self


class RefreshInput(Input):
    operation_id: UUID


@router.post("/plots/{plot_id}/soil", status_code=201)
def record_soil(plot_id: UUID, body: SoilInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    owned_plot(db, farmer.id, plot_id, lock=True)
    require_consent(db, farmer, "agronomic_analysis")
    payload = body.model_dump(mode="json")
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
    existing = db.scalar(
        select(Observation).where(Observation.plot_id == plot_id, Observation.operation_id == body.operation_id)
    )
    if existing:
        if existing.payload_hash != digest:
            raise HTTPException(409, "Operation ID already used with other soil evidence")
        return serialize(existing, exclude=("payload_hash",))
    record = Observation(
        plot_id=plot_id,
        kind="soil",
        observed_at=body.observed_at,
        source_type="farmer_reported_soil",
        source=body.source,
        payload=payload,
        operation_id=body.operation_id,
        payload_hash=digest,
        provenance={
            "method": body.reported_method,
            "evidence_category": "manual_estimate"
            if body.reported_method == "manual_estimate"
            else "farmer_reported_measurement",
            "limitations": [
                "The reported source and measurement have not been independently verified",
                "No conversion between mg/kg and kg/ha without soil density/depth",
            ],
        },
    )
    db.add(record)
    db.flush()
    return serialize(record, exclude=("payload_hash",))


@router.get("/plots/{plot_id}/soil")
def latest_soil(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    owned_plot(db, farmer.id, plot_id)
    record = db.scalar(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "soil")
        .order_by(Observation.observed_at.desc())
        .limit(1)
    )
    return {
        "status": "available" if record else "unavailable",
        "observation": serialize(record, exclude=("payload_hash",)) if record else None,
    }


async def fetch_weather(lat, lon):
    from weather_alerts import weather_alert_service

    current, forecast = await asyncio.gather(
        weather_alert_service.get_current_weather(lat, lon), weather_alert_service.get_forecast(lat, lon, 48)
    )
    if not current or len(forecast) != 48:
        raise HTTPException(503, "Weather provider unavailable or incomplete. Saved evidence remains available.")
    try:
        offset = timezone(timedelta(seconds=int(current["utc_offset_seconds"])))

        def stamp(value):
            parsed = datetime.fromisoformat(value)
            return (parsed if parsed.tzinfo else parsed.replace(tzinfo=offset)).astimezone(timezone.utc).isoformat()

        def validate(row):
            for key, minimum, maximum in [
                ("temperature", -100, 70),
                ("humidity", 0, 100),
                ("wind_speed", 0, 500),
                ("precipitation", 0, 1000),
            ]:
                value = row[key]
                if (
                    isinstance(value, bool)
                    or not isinstance(value, (int, float))
                    or not math.isfinite(value)
                    or not minimum <= value <= maximum
                ):
                    raise ValueError("Invalid weather measurement")
            row["timestamp"] = stamp(row["timestamp"])

        hourly = [item.to_dict() for item in forecast]
        # Current weather has no observed precipitation field; do not invent it.
        validate(current | {"precipitation": 0})
        current["timestamp"] = stamp(current["timestamp"])
        for row in hourly:
            validate(row)
        times = [datetime.fromisoformat(row["timestamp"]) for row in hourly]
        if any(b - a != timedelta(hours=1) for a, b in zip(times, times[1:], strict=False)):
            raise ValueError("Incomplete forecast timeline")
    except (ValueError, TypeError, KeyError, OverflowError):
        raise HTTPException(
            503, "Weather provider returned invalid evidence; saved records remain available."
        ) from None
    return {
        "current": current,
        "hourly": hourly,
        "precipitation_next_24h_mm": sum(item.precipitation for item in forecast[:24]),
        "units": {"temperature": "°C", "wind_speed": "km/h", "humidity": "%", "precipitation": "mm"},
    }


@router.post("/plots/{plot_id}/weather/refresh", status_code=201)
def refresh_weather(
    plot_id: UUID,
    body: RefreshInput,
    request: Request,
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    plot = owned_plot(db, farmer.id, plot_id, lock=True)
    require_consent(db, farmer, "location_processing")
    require_consent(db, farmer, "agronomic_analysis")
    if plot.centroid is None:
        raise HTTPException(422, "Map an approximate field boundary to request local weather")
    existing = db.scalar(
        select(Observation).where(Observation.plot_id == plot_id, Observation.operation_id == body.operation_id)
    )
    if existing:
        if existing.kind != "weather":
            raise HTTPException(409, "Operation ID already used for other evidence")
        return serialize(existing, exclude=("payload_hash",))
    cached = db.scalar(
        select(Observation)
        .where(
            Observation.plot_id == plot_id,
            Observation.kind == "weather",
            Observation.created_at >= utcnow() - timedelta(hours=2),
        )
        .order_by(Observation.created_at.desc())
        .limit(1)
    )
    if cached and cached.provenance.get("boundary_revision") == plot.revision:
        return serialize(cached, exclude=("payload_hash",))
    request.app.state.v2_quotas.check("weather", str(farmer.id), 6, 3600)
    centroid, revision = to_shape(plot.centroid), plot.revision
    # Approximate grid location, not the polygon or an identity, leaves the API.
    lat, lon = round(centroid.y, 2), round(centroid.x, 2)
    db.commit()
    payload = asyncio.run(fetch_weather(lat, lon))
    farmer, _ = authenticate(db, request)
    plot = owned_plot(db, farmer.id, plot_id, lock=True)
    require_consent(db, farmer, "location_processing")
    require_consent(db, farmer, "agronomic_analysis")
    if plot.revision != revision:
        raise HTTPException(409, "Field changed during weather retrieval; retry")
    existing = db.scalar(
        select(Observation).where(Observation.plot_id == plot_id, Observation.operation_id == body.operation_id)
    )
    if existing:
        if existing.kind != "weather":
            raise HTTPException(409, "Operation ID already used for other evidence")
        return serialize(existing, exclude=("payload_hash",))
    record = Observation(
        plot_id=plot_id,
        kind="weather",
        source_type="weather_model",
        source="Open-Meteo",
        observed_at=datetime.fromisoformat(payload["current"]["timestamp"]),
        payload=payload,
        operation_id=body.operation_id,
        payload_hash=hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest(),
        provenance={
            "method": "coarse-area weather model and 48-hour forecast",
            "retrieved_at": utcnow().isoformat(),
            "boundary_revision": revision,
            "location_rounding_degrees": 0.01,
            "limitations": [
                "Model conditions are not a field weather-station measurement",
                "Forecast rain is not observed rainfall",
                "Provider forecasts and weather models have uncertainty",
                "Commercial use requires a separately approved provider/license",
            ],
        },
    )
    db.add(record)
    db.flush()
    return serialize(record, exclude=("payload_hash",))


@router.get("/plots/{plot_id}/weather")
def latest_weather(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    plot = owned_plot(db, farmer.id, plot_id)
    record = db.scalar(
        select(Observation)
        .where(Observation.plot_id == plot_id, Observation.kind == "weather")
        .order_by(Observation.created_at.desc())
        .limit(1)
    )
    valid = record and record.provenance.get("boundary_revision") == plot.revision
    return {
        "status": "available" if valid else "unavailable",
        "observation": serialize(record, exclude=("payload_hash",)) if valid else None,
    }
