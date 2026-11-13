"""Upgrade a field's regional soil guess to the SoilGrids soil map, in the background.

SoilGrids often needs 30 s to more than a minute for a point it has not served
recently, which is too long for spoken setup. When a field is saved with the
labelled regional guess, a ``soil`` job asks SoilGrids with a long timeout from
the durable queue. If the farmer has not changed the soil since, the estimate
is replaced by the soil-map class and the farmer gets a notice saying so.
Nothing else about the field changes, and its revision is left alone so a
satellite job or a farmer's edit is never invalidated by this.
"""

import logging
from datetime import timedelta
from uuid import uuid5

import httpx
from geoalchemy2.shape import to_shape
from sqlalchemy import select

from db.models import Consent, Farm, Farmer, Job, Notification, Plot, utcnow

from .agronomy import soil_from_texture
from .farm_context.providers import normalize_soil
from .farm_context.transport import ENDPOINTS, Unavailable

logger = logging.getLogger("krishyak.v2.soil")
ESTIMATED = "state_typical"
PROPERTIES = ("clay", "sand", "silt", "phh2o")


def field_point(plot):
    point = plot.centroid if plot.centroid is not None else plot.approximate_location
    if point is None:
        return None
    shape = to_shape(point)
    return round(shape.y, 2), round(shape.x, 2)


def has_location_consent(db, farmer_id):
    return bool(
        db.scalar(
            select(Consent.id).where(
                Consent.farmer_id == farmer_id,
                Consent.purpose == "location_processing",
                Consent.withdrawn_at.is_(None),
            )
        )
    )


def queue(db, plot, farmer_id):
    """Queue a refinement for a field saved with the regional soil guess."""
    soil = plot.soil_metadata or {}
    if soil.get("source") != ESTIMATED or field_point(plot) is None or not has_location_consent(db, farmer_id):
        return False
    operation = uuid5(plot.id, "soil-map-v1")
    if db.scalar(select(Job.id).where(Job.plot_id == plot.id, Job.operation_id == operation)):
        return False
    db.add(Job(plot_id=plot.id, operation_id=operation, kind="soil", payload={"version": 1}))
    return True


def target(db, plot, farm, owner):
    """Where to sample, or None when the job no longer applies."""
    if (
        plot is None
        or owner is None
        or owner.status != "active"
        or (plot.soil_metadata or {}).get("source") != ESTIMATED
        or not has_location_consent(db, farm.farmer_id)
    ):
        return None
    point = field_point(plot)
    return (point, owner.state) if point else None


def read_soil(point, state, client_factory=None):
    """Soil class from SoilGrids texture, or None. Raises Unavailable to retry later."""
    client_factory = client_factory or httpx.Client
    lat, lon = point
    # Built-up land has no soil value; a village point may be inside the village.
    for offset in (0.0, 0.04):
        params = [("lat", round(lat + offset, 2)), ("lon", lon), ("depth", "0-5cm"), ("value", "mean")]
        params += [("property", name) for name in PROPERTIES]
        try:
            with client_factory(timeout=httpx.Timeout(40, connect=5), follow_redirects=False) as client:
                response = client.get(
                    ENDPOINTS["soilgrids"],
                    params=params,
                    headers={"User-Agent": "Krishyak/2.0 (+https://krishyak.vercel.app)", "Accept": "application/json"},
                )
        except httpx.HTTPError:
            raise Unavailable() from None
        if response.status_code != 200 or "json" not in response.headers.get("content-type", ""):
            raise Unavailable()
        try:
            soil = normalize_soil(response.json())
        except (Unavailable, KeyError, TypeError, ValueError):
            continue  # no soil value at this point: try the farmland sample
        kind = soil_from_texture(soil, state)
        if kind:
            return kind, soil
    return None


def run(factory, job_id, plot_id, attempt, point, state, client_factory=None):
    try:
        found = read_soil(point, state, client_factory)
    except Unavailable:
        with factory.begin() as db:
            job = db.get(Job, job_id)
            if job and job.status == "running" and job.attempts == attempt:
                job.status = "retry" if job.attempts < 3 else "failed"
                job.error_code, job.leased_until = "soil_map_unavailable", None
                job.available_at = utcnow() + timedelta(minutes=10 * job.attempts)
        logger.warning("Soil refinement deferred code=soil_map_unavailable")
        return True
    with factory.begin() as db:
        job = db.scalar(select(Job).where(Job.id == job_id).with_for_update())
        if job is None or job.status != "running" or job.attempts != attempt:
            return True
        plot = db.scalar(select(Plot).where(Plot.id == plot_id).with_for_update())
        farm = db.get(Farm, plot.farm_id) if plot else None
        owner = db.scalar(select(Farmer).where(Farmer.id == farm.farmer_id)) if farm else None
        # Rechecked after the provider call: the farmer may have edited the soil,
        # withdrawn location permission or deleted the field meanwhile.
        if target(db, plot, farm, owner) is None:
            job.status, job.leased_until = "cancelled", None
            return True
        job.status, job.error_code, job.leased_until = "completed", None, None
        if found is None:
            return True
        kind, _ = found
        current = dict(plot.soil_metadata or {})
        plot.soil_metadata = {**current, "soil_type": kind, "source": "soil_map"}
        notice = uuid5(job.operation_id, "soil-updated")
        if not db.scalar(
            select(Notification.id).where(Notification.farmer_id == owner.id, Notification.operation_id == notice)
        ):
            db.add(
                Notification(
                    farmer_id=owner.id,
                    plot_id=plot.id,
                    operation_id=notice,
                    kind="soil_updated",
                    payload={
                        "title": "Soil estimate updated",
                        "message": "The soil map now gives an estimate for this field. Check it in My fields and change it if your soil is different.",
                        "soil_type": kind,
                        "previous": current.get("soil_type"),
                    },
                )
            )
    return True
