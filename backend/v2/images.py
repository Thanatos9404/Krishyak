"""Validated private image evidence and consented, audited expert feedback."""

import io
import json
from datetime import timedelta
from functools import wraps
from pathlib import Path
from threading import BoundedSemaphore
from uuid import UUID, uuid4, uuid5

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select

from db.models import AuditLog, Consent, Feedback, ImageAsset, ObjectDeletion, Observation, utcnow
from repositories.ownership import owned_plot

from .providers import object_storage, sanitize_image
from .router import current_farmer, database, require_consent, serialize
from .schemas import FeedbackInput, ReviewInput

router = APIRouter(prefix="/api/v2", tags=["Private crop health"])
scan_slot = BoundedSemaphore(1)


def bounded_scan(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        if not scan_slot.acquire(blocking=False):
            raise HTTPException(429, "Photo processing is busy; retry shortly", headers={"Retry-After": "5"})
        try:
            return function(*args, **kwargs)
        finally:
            scan_slot.release()

    return wrapped


def model_release():
    from model_inference import CLASS_INDICES_PATH, MODEL_PATH

    try:
        release = json.loads((Path(MODEL_PATH).parent / "release.json").read_text(encoding="utf-8"))
        labels = json.loads(Path(CLASS_INDICES_PATH).read_text(encoding="utf-8"))
        if not isinstance(labels, dict) or release["classes"] != len(labels):
            raise ValueError()
        return release, list(labels.values())
    except (OSError, ValueError, KeyError, TypeError):
        raise HTTPException(503, "Classifier metadata unavailable") from None


@router.get("/model")
def release():
    from model_inference import class_crop, is_model_available

    metadata, labels = model_release()
    return {
        "release": metadata,
        "classes": labels,
        "supported_crops": sorted(set(filter(None, map(class_crop, labels)))),
        "available": is_model_available(),
        "limitations": [
            "External performance differs from internal evaluation",
            "Scores are uncalibrated",
            "Severity and field health are not measured",
        ],
    }


def owned_image(db, farmer, image_id):
    image = db.scalar(select(ImageAsset).where(ImageAsset.id == image_id, ImageAsset.farmer_id == farmer.id))
    if image is None:
        raise HTTPException(404, "Image not found")
    return image


@router.post("/disease-scans", status_code=201)
@bounded_scan
def scan(
    request: Request,
    operation_id: UUID = Form(...),
    plot_id: UUID = Form(...),
    crop: str = Form(..., max_length=100),
    image: UploadFile = File(...),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    owned_plot(db, farmer.id, plot_id)
    require_consent(db, farmer, "agronomic_analysis")
    content = image.file.read(8 * 1024 * 1024 + 1)
    try:
        clean, width, height, digest = sanitize_image(content, image.content_type)
    except (ValueError, UnidentifiedImageError, Image.DecompressionBombError, OSError):
        raise HTTPException(
            422, "Use a valid single JPEG, PNG or WebP image within size and dimension limits"
        ) from None
    finally:
        image.file.close()
    existing = db.scalar(
        select(ImageAsset).where(ImageAsset.farmer_id == farmer.id, ImageAsset.operation_id == operation_id)
    )
    if existing:
        if existing.plot_id != plot_id or existing.sha256 != digest or existing.result.get("crop") != crop:
            raise HTTPException(409, "Operation ID already used for another photograph")
        return {"image_id": existing.id, "result": existing.result}
    request.app.state.v2_quotas.check("images", str(farmer.id), 10, 3600)
    metadata, labels = model_release()
    from model_inference import class_crop, predict_from_image

    crop_alias = {"corn": "maize", "grapes": "grape", "citrus": "orange"}.get(crop.casefold(), crop.casefold())
    supported = set(filter(None, map(class_crop, labels)))
    raw = predict_from_image(clean, crop_type=crop) if crop_alias in supported else {"status": "unsupported"}
    status = (
        "unsupported"
        if crop_alias not in supported
        else {"disease_detected": "detected"}.get(raw.get("status"), raw.get("status", "unavailable"))
    )
    if status not in {"detected", "healthy", "uncertain", "unsupported", "unavailable"}:
        status = "unavailable"
    predicted = (raw.get("disease") or {}).get("name")
    alternatives = [
        {"class": x["class"], "model_score": x["confidence"]}
        for x in raw.get("top_predictions", [])
        if x.get("class") in labels
    ]
    result = {
        "status": status,
        "model_id": metadata["model_id"],
        "preprocessing_version": "rgb-exif-white-alpha-max2048-jpeg92-224-v2",
        "predicted_class": predicted if predicted in labels and status == "detected" else None,
        "model_score": raw.get("confidence", (raw.get("disease") or {}).get("confidence")),
        "alternatives": alternatives,
        "crop": crop,
        "observed_at": utcnow().isoformat(),
        "recommended_next_step": "Inspect symptoms and seek local expert confirmation before treatment.",
        "limitations": [
            "Model score is not calibrated disease probability",
            "Healthy-class prediction does not rule out disease",
            "Classification does not measure field severity",
            "Chemical treatment and dosing require locally applicable expert/label verification",
        ],
    }
    # Unreviewed pesticide doses from legacy knowledge tables are intentionally
    # not promoted into v2 authoritative advice.
    object_key = f"{farmer.id}/{uuid4()}.jpg"
    cleanup = ObjectDeletion(object_key=object_key, available_at=utcnow() + timedelta(hours=1))
    db.add(cleanup)
    db.commit()  # An upload interrupted before attachment still has durable cleanup.
    try:
        object_storage(request.app.state.v2_settings).put(object_key, clean)
    except Exception:
        raise HTTPException(503, "Photo storage unavailable; retry later") from None
    from .auth import authenticate

    farmer, _ = authenticate(db, request)
    owned_plot(db, farmer.id, plot_id, lock=True)
    require_consent(db, farmer, "agronomic_analysis")
    existing = db.scalar(
        select(ImageAsset).where(ImageAsset.farmer_id == farmer.id, ImageAsset.operation_id == operation_id)
    )
    if existing:
        if existing.plot_id != plot_id or existing.sha256 != digest or existing.result.get("crop") != crop:
            raise HTTPException(409, "Operation ID already used for another photograph")
        return {"image_id": existing.id, "result": existing.result}
    consent = db.scalar(
        select(Consent).where(
            Consent.farmer_id == farmer.id, Consent.purpose == "model_improvement", Consent.withdrawn_at.is_(None)
        )
    )
    asset = ImageAsset(
        farmer_id=farmer.id,
        plot_id=plot_id,
        object_key=object_key,
        sha256=digest,
        mime="image/jpeg",
        width=width,
        height=height,
        research_consent_id=consent.id if consent else None,
        result=result,
        operation_id=operation_id,
    )
    db.add(asset)
    db.delete(cleanup)
    db.flush()
    db.add(
        Observation(
            plot_id=plot_id,
            kind="disease_scan",
            observed_at=utcnow(),
            source_type="image_classifier",
            source=metadata["model_id"],
            operation_id=uuid5(operation_id, "scan-timeline"),
            payload={"image_id": str(asset.id), "result": result},
            payload_hash=digest,
            provenance={
                "model_id": metadata["model_id"],
                "method": "image classification",
                "limitations": result["limitations"],
            },
        )
    )
    return {"image_id": asset.id, "result": result}


@router.get("/disease-scans")
def scans(
    plot_id: UUID | None = None,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    records = db.scalars(
        select(ImageAsset)
        .where(ImageAsset.farmer_id == farmer.id, *([ImageAsset.plot_id == plot_id] if plot_id else []))
        .order_by(ImageAsset.created_at.desc(), ImageAsset.id)
        .offset(offset)
        .limit(limit)
    )
    return {"items": [serialize(x, exclude=("object_key",)) for x in records]}


@router.get("/disease-scans/{image_id}/image")
def download(image_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    asset = owned_image(db, farmer, image_id)
    try:
        content = object_storage(request.app.state.v2_settings).get(asset.object_key)
    except Exception:
        raise HTTPException(503, "Photo unavailable; retry later") from None
    return StreamingResponse(io.BytesIO(content), media_type=asset.mime, headers={"Cache-Control": "no-store"})


@router.delete("/disease-scans/{image_id}")
def remove_image(image_id: UUID, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    asset = owned_image(db, farmer, image_id)
    db.add(ObjectDeletion(object_key=asset.object_key))
    db.delete(asset)
    return {"status": "deleted", "object_cleanup": "queued"}


@router.post("/feedback", status_code=201)
def feedback(body: FeedbackInput, farmer=Depends(current_farmer), db=Depends(database, scope="function")):
    owned_image(db, farmer, body.image_id)
    require_consent(db, farmer, "agronomic_analysis")
    existing = db.scalar(
        select(Feedback).where(Feedback.farmer_id == farmer.id, Feedback.operation_id == body.operation_id)
    )
    if existing:
        if any(getattr(existing, key) != value for key, value in body.model_dump().items()):
            raise HTTPException(409, "Operation ID already used for other feedback")
        return serialize(existing)
    record = Feedback(farmer_id=farmer.id, **body.model_dump())
    db.add(record)
    db.flush()
    return serialize(record)


def reviewer(farmer, request, db):
    from .auth import authenticate

    _, session = authenticate(db, request)
    if farmer.role not in {"agronomist", "admin"}:
        raise HTTPException(403, "Agronomist role required")
    if session.authenticated_at < utcnow() - timedelta(minutes=10):
        raise HTTPException(401, "Sign in again before expert review")


@router.get("/review-queue")
def queue(
    request: Request,
    offset: int = Query(0, ge=0, le=100000),
    limit: int = Query(20, ge=1, le=100),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    reviewer(farmer, request, db)
    records = db.scalars(
        select(ImageAsset)
        .join(Consent, ImageAsset.research_consent_id == Consent.id)
        .where(
            Consent.withdrawn_at.is_(None),
            Consent.purpose == "model_improvement",
            ~select(Feedback.id).where(Feedback.image_id == ImageAsset.id, Feedback.reviewed_at.is_not(None)).exists(),
        )
        .order_by(ImageAsset.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    # No phone, name or exact polygon in the expert queue.
    return {"items": [{"image_id": x.id, "result": x.result, "created_at": x.created_at} for x in records]}


@router.post("/review-queue/{image_id}")
def review(
    image_id: UUID,
    body: ReviewInput,
    request: Request,
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    reviewer(farmer, request, db)
    asset = db.scalar(
        select(ImageAsset)
        .join(Consent, ImageAsset.research_consent_id == Consent.id)
        .where(ImageAsset.id == image_id, Consent.withdrawn_at.is_(None), Consent.purpose == "model_improvement")
        .with_for_update(of=ImageAsset)
    )
    if asset is None:
        raise HTTPException(404, "Consented image not found")
    _, labels = model_release()
    if body.corrected_class not in labels:
        raise HTTPException(422, "Correction must match the active classifier label set")
    existing = db.scalar(
        select(Feedback).where(Feedback.farmer_id == asset.farmer_id, Feedback.operation_id == body.operation_id)
    )
    if existing:
        if (
            existing.reviewer_id != farmer.id
            or existing.image_id != image_id
            or existing.corrected_class != body.corrected_class
            or existing.note != body.note
        ):
            raise HTTPException(409, "Operation ID already used for another review")
        return serialize(existing)
    record = Feedback(
        farmer_id=asset.farmer_id,
        image_id=asset.id,
        verdict="expert_reviewed",
        note=body.note,
        corrected_class=body.corrected_class,
        reviewer_id=farmer.id,
        reviewed_at=utcnow(),
        operation_id=body.operation_id,
    )
    db.add(record)
    db.add(
        AuditLog(
            actor_id=farmer.id,
            action="diagnosis_review",
            target_id=image_id,
            details={"corrected_class": body.corrected_class},
        )
    )
    db.flush()
    return serialize(record)


@router.get("/review-queue/{image_id}/image")
def review_image(
    image_id: UUID, request: Request, farmer=Depends(current_farmer), db=Depends(database, scope="function")
):
    reviewer(farmer, request, db)
    asset = db.scalar(
        select(ImageAsset)
        .join(Consent, ImageAsset.research_consent_id == Consent.id)
        .where(ImageAsset.id == image_id, Consent.withdrawn_at.is_(None), Consent.purpose == "model_improvement")
    )
    if asset is None:
        raise HTTPException(404, "Consented image not found")
    try:
        content = object_storage(request.app.state.v2_settings).get(asset.object_key)
    except Exception:
        raise HTTPException(503, "Photo unavailable; retry later") from None
    db.add(AuditLog(actor_id=farmer.id, action="consented_image_view", target_id=image_id))
    return StreamingResponse(io.BytesIO(content), media_type=asset.mime, headers={"Cache-Control": "no-store"})
