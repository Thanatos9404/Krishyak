"""Authenticated private-resource API. Legacy public planning remains separate."""

import hashlib
import json
from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import mapping, shape
from sqlalchemy import func, select, text, update
from sqlalchemy.exc import SQLAlchemyError

from db.models import AuthChallenge, Consent, CropCycle, Farm, Farmer, Observation, Plot, utcnow
from remote_sensing.geometry import area_details
from repositories.ownership import owned_farm, owned_plot

from .auth import authenticate, check_origin, clear_session, issue_session
from .providers import otp_provider
from .schemas import (
    ConsentInput,
    CycleInput,
    CycleUpdate,
    FarmInput,
    FarmUpdate,
    ObservationInput,
    PlotInput,
    PlotUpdate,
    ProfileInput,
    RequestOTP,
    VerifyOTP,
)

router = APIRouter(prefix="/api/v2", tags=["Field Intelligence v2"])


def database(request: Request):
    factory = getattr(request.app.state, "v2_database", None)
    if factory is None:
        raise HTTPException(503, "Farm accounts are not yet available")
    with factory() as db:
        try:
            yield db
            db.commit()
        except SQLAlchemyError:
            db.rollback()
            raise HTTPException(503, "Farm storage unavailable; retry later") from None
        except Exception:
            db.rollback()
            raise


def current_farmer(request: Request, db=Depends(database, scope="function")):
    return authenticate(db, request)[0]


def require_consent(db, farmer, purpose):
    consent = db.scalar(
        select(Consent).where(
            Consent.farmer_id == farmer.id, Consent.purpose == purpose, Consent.withdrawn_at.is_(None)
        )
    )
    if consent is None:
        raise HTTPException(403, f"Consent required for {purpose}")
    return consent


def serialize(record, *, exclude=()):
    result = {}
    for column in record.__table__.columns:
        name = column.key
        if name in exclude:
            continue
        value = getattr(record, name)
        if name in {"boundary", "centroid"}:
            value = mapping(to_shape(value)) if value is not None else None
        result[name] = value
    return result


def profile(farmer):
    return serialize(farmer)


@router.get("/status")
def status(request: Request):
    settings = request.app.state.v2_settings
    from remote_sensing.router import get_service

    return {
        "enabled": settings.enabled,
        "environment": settings.environment,
        "development_identity": settings.enabled and settings.otp_provider == "development",
        "otp_available": settings.enabled and settings.otp_provider != "disabled",
        "policy_version": "2026-10-03",
        "satellite_configuration": get_service().status()["status"],
        "satellite_live_access_verified": False,
    }


@router.post("/auth/request-otp")
def request_otp(body: RequestOTP, request: Request, db=Depends(database, scope="function")):
    check_origin(request)
    settings = request.app.state.v2_settings
    quotas = request.app.state.v2_quotas
    ip = request.client.host if request.client else "unknown"
    quotas.check("otp_ip", ip, 6, 600)
    quotas.check("otp_mobile", body.mobile, 3, 600)
    quotas.check("otp_global", "global", 300, 86400)
    # Serializes challenge issuance for a phone across processes without storing
    # the phone in a SQL statement/log. Existing outstanding challenges expire.
    db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"),
        {"key": int.from_bytes(hashlib.sha256(body.mobile.encode()).digest()[:8], "big", signed=True)},
    )
    db.execute(
        update(AuthChallenge)
        .where(AuthChallenge.mobile == body.mobile, AuthChallenge.consumed.is_(False))
        .values(consumed=True)
    )
    reference = otp_provider(settings).send(body.mobile)
    challenge = AuthChallenge(
        mobile=body.mobile,
        provider=settings.otp_provider,
        provider_reference=reference,
        expires_at=utcnow() + timedelta(minutes=5),
    )
    db.add(challenge)
    db.flush()
    return {
        "challenge_id": challenge.id,
        "expires_in": 300,
        "development_identity": settings.otp_provider == "development",
    }


@router.post("/auth/verify-otp")
def verify_otp(body: VerifyOTP, request: Request, response: Response, db=Depends(database, scope="function")):
    check_origin(request)
    request.app.state.v2_quotas.check("otp_check", request.client.host if request.client else "unknown", 20, 600)
    mobile = db.scalar(select(AuthChallenge.mobile).where(AuthChallenge.id == body.challenge_id))
    if mobile is None:
        raise HTTPException(400, "Verification expired or invalid; request a new code")
    db.execute(
        text("SELECT pg_advisory_xact_lock(:key)"),
        {"key": int.from_bytes(hashlib.sha256(mobile.encode()).digest()[:8], "big", signed=True)},
    )
    challenge = db.scalar(select(AuthChallenge).where(AuthChallenge.id == body.challenge_id).with_for_update())
    settings = request.app.state.v2_settings
    if (
        challenge is None
        or challenge.consumed
        or challenge.expires_at <= utcnow()
        or challenge.attempts >= 5
        or challenge.provider != settings.otp_provider
    ):
        raise HTTPException(400, "Verification expired or invalid; request a new code")
    challenge.attempts += 1
    # Persist failed attempts before a provider failure or incorrect code can
    # roll back the counter. Keep the row locked during provider verification.
    try:
        approved = otp_provider(settings).check(challenge.mobile, challenge.provider_reference, body.code)
    except HTTPException:
        db.commit()
        raise
    if not approved:
        db.commit()
        raise HTTPException(400, "Incorrect or expired verification code")
    challenge.consumed = True
    farmer = db.scalar(select(Farmer).where(Farmer.mobile == challenge.mobile))
    if farmer is None:
        farmer = Farmer(mobile=challenge.mobile)
        db.add(farmer)
        db.flush()
    if farmer.status != "active":
        db.commit()
        raise HTTPException(403, "Account unavailable")
    if not db.scalar(
        select(Consent.id).where(
            Consent.farmer_id == farmer.id, Consent.purpose == "account_operation", Consent.withdrawn_at.is_(None)
        )
    ):
        db.add(
            Consent(
                farmer_id=farmer.id,
                purpose="account_operation",
                categories=["profile"],
                policy_version=body.accept_policy_version,
                consent_version="v1",
                collection_surface="otp_sign_in",
            )
        )
    auth = issue_session(db, farmer, settings, response)
    return {"farmer": profile(farmer), **auth}


@router.post("/auth/refresh")
def refresh(request: Request, response: Response, db=Depends(database, scope="function")):
    farmer, session = authenticate(db, request, refresh=True, lock=True)
    session.revoked = True
    return issue_session(
        db,
        farmer,
        request.app.state.v2_settings,
        response,
        refresh_deadline=session.refresh_expires_at,
        authenticated_at=session.authenticated_at,
    )


@router.post("/auth/logout")
def logout(request: Request, response: Response, db=Depends(database, scope="function")):
    _, session = authenticate(db, request, refresh=True, lock=True)
    session.revoked = True
    clear_session(response, request.app.state.v2_settings)
    return {"status": "signed_out"}


@router.get("/me")
def me(request: Request, farmer=Depends(current_farmer)):
    return {"farmer": profile(farmer), "csrf_token": request.cookies.get("krishyak_csrf")}


@router.get("/auth/session")
def session_context(request: Request, db=Depends(database, scope="function")):
    # Read-only bootstrap permits a reload after access expiry. A new access
    # cookie still requires the CSRF-verified POST refresh operation.
    farmer, _ = authenticate(db, request, refresh=True)
    return {"farmer": profile(farmer), "csrf_token": request.cookies.get("krishyak_csrf")}


@router.patch("/me")
def update_me(body: ProfileInput, farmer=Depends(current_farmer)):
    for name, value in body.model_dump().items():
        setattr(farmer, name, value)
    return {"farmer": profile(farmer)}


@router.get("/consents")
def consents(farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    records = db.scalars(
        select(Consent).where(Consent.farmer_id == farmer.id).order_by(Consent.created_at.desc()).limit(100)
    )
    return {"items": [serialize(x) for x in records]}


@router.post("/consents")
def set_consent(body: ConsentInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    if body.purpose == "account_operation" and not body.granted:
        raise HTTPException(422, "Use account deletion to end account processing")
    db.execute(select(Farmer.id).where(Farmer.id == farmer.id).with_for_update())
    previous = db.scalars(
        select(Consent).where(
            Consent.farmer_id == farmer.id, Consent.purpose == body.purpose, Consent.withdrawn_at.is_(None)
        )
    ).all()
    if body.granted and previous:
        return serialize(previous[0])
    for record in previous:
        record.withdrawn_at = utcnow()
    if body.granted:
        record = Consent(
            farmer_id=farmer.id,
            purpose=body.purpose,
            categories=[body.purpose],
            policy_version=body.policy_version,
            consent_version="v1",
            collection_surface="privacy_settings",
        )
        db.add(record)
        db.flush()
        return serialize(record)
    if body.purpose == "model_improvement":
        from db.models import ImageAsset

        db.execute(update(ImageAsset).where(ImageAsset.farmer_id == farmer.id).values(research_consent_id=None))
    if body.purpose == "satellite_processing":
        from db.models import Job

        plots = select(Plot.id).join(Farm).where(Farm.farmer_id == farmer.id)
        db.execute(
            update(Job).where(Job.plot_id.in_(plots), Job.status.in_(["pending", "retry"])).values(status="cancelled")
        )
    if body.purpose == "pilot_research":
        from db.models import PilotEnrollment

        db.execute(
            update(PilotEnrollment)
            .where(PilotEnrollment.farmer_id == farmer.id, PilotEnrollment.withdrawn_at.is_(None))
            .values(withdrawn_at=utcnow())
        )
    return {"purpose": body.purpose, "granted": False}


@router.get("/farms")
def farms(
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    items = db.scalars(
        select(Farm).where(Farm.farmer_id == farmer.id).order_by(Farm.created_at, Farm.id).offset(offset).limit(limit)
    )
    return {"items": [serialize(x) for x in items], "offset": offset, "limit": limit}


@router.post("/farms", status_code=201)
def create_farm(body: FarmInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    db.execute(select(Farmer.id).where(Farmer.id == farmer.id).with_for_update())
    existing = db.scalar(select(Farm).where(Farm.farmer_id == farmer.id, Farm.operation_id == body.operation_id))
    if existing:
        if any(getattr(existing, key) != value for key, value in body.model_dump().items()):
            raise HTTPException(409, "Operation ID already used for another farm")
        return serialize(existing)
    if db.scalar(select(func.count()).select_from(Farm).where(Farm.farmer_id == farmer.id)) >= 100:
        raise HTTPException(422, "Maximum 100 farms per account reached")
    farm = Farm(farmer_id=farmer.id, **body.model_dump())
    db.add(farm)
    db.flush()
    return serialize(farm)


@router.patch("/farms/{farm_id}")
def rename_farm(
    farm_id: UUID, body: FarmUpdate, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    farm = owned_farm(db, farmer.id, farm_id)
    if farm.revision != body.revision:
        raise HTTPException(409, "Farm changed on another device; refresh before saving")
    farm.name = body.name
    farm.revision += 1
    db.flush()
    return serialize(farm)


@router.get("/plots")
def plots(
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    records = db.scalars(
        select(Plot)
        .join(Farm)
        .where(Farm.farmer_id == farmer.id)
        .order_by(Plot.created_at, Plot.id)
        .offset(offset)
        .limit(limit)
    )
    return {"items": [serialize(x) for x in records], "offset": offset, "limit": limit}


def plot_values(body, db, farmer):
    owned_farm(db, farmer.id, body.farm_id)
    values = body.model_dump(exclude={"revision", "boundary"})
    if body.boundary is not None:
        require_consent(db, farmer, "location_processing")
        geometry = body.boundary.model_dump()
        try:
            area_details(geometry)
        except ValueError:
            raise HTTPException(422, "Field geometry exceeds supported limits") from None
        boundary = from_shape(shape(geometry), srid=4326)
        # PostGIS geography area and centroid are the persisted source of truth.
        area = db.scalar(select(func.ST_Area(func.ST_GeogFromWKB(func.ST_AsBinary(boundary))) / 10000))
        centroid = db.scalar(select(func.ST_Centroid(boundary)))
        values.update(boundary=boundary, centroid=centroid, area_hectares=area)
    else:
        values.update(boundary=None, centroid=None, area_hectares=None)
    return values


@router.post("/plots", status_code=201)
def create_plot(body: PlotInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    farm = owned_farm(db, farmer.id, body.farm_id)
    db.execute(select(Farm.id).where(Farm.id == farm.id).with_for_update())
    existing = db.scalar(select(Plot).where(Plot.farm_id == farm.id, Plot.operation_id == body.operation_id))
    if existing:
        saved = serialize(existing)
        for key, value in body.model_dump(mode="json").items():
            previous = saved.get(key)
            if key in {"farm_id", "operation_id"}:
                previous = str(previous)
            if key == "entered_area_hectares" and previous is not None:
                previous = float(previous)
            if key == "boundary" and previous is not None:
                previous = json.loads(json.dumps(previous))
            if previous != value:
                raise HTTPException(409, "Operation ID already used for another field")
        return saved
    plot = Plot(**plot_values(body, db, farmer))
    db.add(plot)
    db.flush()
    return serialize(plot)


@router.get("/plots/{plot_id}")
def get_plot(plot_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    return serialize(owned_plot(db, farmer.id, plot_id))


@router.put("/plots/{plot_id}")
def update_plot(
    plot_id: UUID, body: PlotUpdate, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    plot = owned_plot(db, farmer.id, plot_id, lock=True)
    if plot.revision != body.revision:
        raise HTTPException(409, "Field changed on another device; refresh before saving")
    values = plot_values(body, db, farmer)
    values.pop("operation_id", None)
    boundary_changed = (body.boundary.model_dump() if body.boundary else None) != (
        json.loads(json.dumps(mapping(to_shape(plot.boundary)))) if plot.boundary is not None else None
    )
    if boundary_changed:
        from db.models import Job

        db.execute(
            update(Job).where(Job.plot_id == plot.id, Job.status.in_(["pending", "retry"])).values(status="cancelled")
        )
    for name, value in values.items():
        setattr(plot, name, value)
    plot.revision += 1
    db.flush()
    return serialize(plot)


@router.post("/plots/{plot_id}/crop-cycles", status_code=201)
def create_cycle(
    plot_id: UUID, body: CycleInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    owned_plot(db, farmer.id, plot_id, lock=True)
    existing = db.scalar(
        select(CropCycle).where(CropCycle.plot_id == plot_id, CropCycle.operation_id == body.operation_id)
    )
    if existing:
        if any(getattr(existing, key) != value for key, value in body.model_dump().items()):
            raise HTTPException(409, "Operation ID already used for another crop cycle")
        return serialize(existing)
    if body.status in {"active", "planned"}:
        overlapping = db.scalar(
            select(CropCycle.id).where(
                CropCycle.plot_id == plot_id,
                CropCycle.status.in_(["active", "planned"]),
                CropCycle.sowing_date <= body.expected_harvest,
                CropCycle.expected_harvest >= body.sowing_date,
            )
        )
        if overlapping:
            raise HTTPException(409, "Crop cycle overlaps an existing active or planned cycle")
    cycle = CropCycle(plot_id=plot_id, **body.model_dump())
    db.add(cycle)
    db.flush()
    return serialize(cycle)


@router.get("/plots/{plot_id}/crop-cycles")
def cycles(
    plot_id: UUID,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    owned_plot(db, farmer.id, plot_id)
    rows = db.scalars(
        select(CropCycle)
        .where(CropCycle.plot_id == plot_id)
        .order_by(CropCycle.sowing_date.desc(), CropCycle.id)
        .offset(offset)
        .limit(limit)
    )
    return {"items": [serialize(x) for x in rows]}


@router.put("/crop-cycles/{cycle_id}")
def update_cycle(
    cycle_id: UUID, body: CycleUpdate, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    cycle = db.scalar(
        select(CropCycle)
        .join(Plot)
        .join(Farm)
        .where(CropCycle.id == cycle_id, Farm.farmer_id == farmer.id)
        .with_for_update(of=CropCycle)
    )
    if cycle is None:
        raise HTTPException(404, "Crop cycle not found")
    if cycle.revision != body.revision:
        raise HTTPException(409, "Crop cycle changed; refresh before saving")
    if body.status in {"active", "planned"} and db.scalar(
        select(CropCycle.id).where(
            CropCycle.plot_id == cycle.plot_id,
            CropCycle.id != cycle.id,
            CropCycle.status.in_(["active", "planned"]),
            CropCycle.sowing_date <= body.expected_harvest,
            CropCycle.expected_harvest >= body.sowing_date,
        )
    ):
        raise HTTPException(409, "Crop cycle overlaps another active or planned cycle")
    for name, value in body.model_dump(exclude={"operation_id", "revision"}).items():
        setattr(cycle, name, value)
    cycle.revision += 1
    db.flush()
    return serialize(cycle)


@router.delete("/crop-cycles/{cycle_id}")
def delete_cycle(cycle_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    cycle = db.scalar(
        select(CropCycle).join(Plot).join(Farm).where(CropCycle.id == cycle_id, Farm.farmer_id == farmer.id)
    )
    if cycle is None:
        raise HTTPException(404, "Crop cycle not found")
    db.delete(cycle)
    return {"status": "deleted"}


@router.post("/plots/{plot_id}/observations", status_code=201)
def record_observation(
    plot_id: UUID, body: ObservationInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    owned_plot(db, farmer.id, plot_id, lock=True)
    require_consent(db, farmer, "agronomic_analysis")
    payload = body.model_dump(mode="json")
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    existing = db.scalar(
        select(Observation).where(Observation.plot_id == plot_id, Observation.operation_id == body.operation_id)
    )
    if existing:
        if existing.payload_hash != digest:
            raise HTTPException(409, "Operation ID already used with different evidence")
        return serialize(existing, exclude=("payload_hash",))
    observation = Observation(
        plot_id=plot_id,
        kind=body.kind,
        observed_at=body.observed_at,
        source_type="farmer_entered",
        source="Farmer observation",
        operation_id=body.operation_id,
        payload=payload,
        payload_hash=digest,
        provenance={"method": "manual entry", "limitations": ["Not independently verified"]},
    )
    db.add(observation)
    db.flush()
    return serialize(observation, exclude=("payload_hash",))


@router.get("/plots/{plot_id}/timeline")
def timeline(
    plot_id: UUID,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    owned_plot(db, farmer.id, plot_id)
    rows = db.scalars(
        select(Observation)
        .where(Observation.plot_id == plot_id)
        .order_by(Observation.observed_at.desc(), Observation.id)
        .offset(offset)
        .limit(limit)
    )
    return {"items": [serialize(x, exclude=("payload_hash",)) for x in rows], "offset": offset, "limit": limit}
