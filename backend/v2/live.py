"""Krishyak Live: point the camera at the crop, ask aloud, hear an answer.

Each turn carries one camera frame and the farmer's question. Krishyak's own
leaf model reads the frame, and the assistant answers from that result and the
farmer's field records. The frame and the conversation are never stored.
"""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError
from pydantic import TypeAdapter, ValidationError

from sarvam_service import LANGUAGES
from security import client_ip
from speech_limits import positive_env

from .assistant import CAMERA, Turn, complete, gather_facts, parse_reply, system_prompt
from .auth import authenticate
from .images import classify, scan_slot
from .providers import sanitize_image
from .radar import field_crop
from .router import current_farmer, database, require_consent

router = APIRouter(prefix="/api/v2/live", tags=["Krishyak Live"])
HISTORY = TypeAdapter(list[Turn])


def look(frame, crop_id):
    """What the leaf model sees; never raises for an unreadable frame."""
    if not scan_slot.acquire(timeout=8):
        return {"status": "unavailable"}
    try:
        result, _ = classify(frame, crop_id)
    except HTTPException:
        return {"status": "unavailable"}
    finally:
        scan_slot.release()
    guidance = result.get("guidance") or {}
    return {
        "status": result["status"],
        "predicted_class": result.get("predicted_class"),
        "likely_problem": guidance.get("name"),
        "cause": guidance.get("cause"),
        "urgent": bool(guidance.get("urgent")),
        "first_steps": guidance.get("steps", [])[:4],
    }


@router.post("/turn")
async def turn(
    request: Request,
    question: str = Form(..., min_length=1, max_length=500),
    language: str = Form(..., min_length=2, max_length=16),
    plot_id: UUID | None = Form(default=None),
    history: str = Form(default="[]", max_length=12000),
    frame: UploadFile | None = File(default=None),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    require_consent(db, farmer, "speech_processing")
    code = language.split("-")[0].lower()
    if code not in LANGUAGES:
        raise HTTPException(422, "Select a supported language")
    try:
        turns = HISTORY.validate_python(json.loads(history))[-6:]
    except (ValueError, ValidationError):
        raise HTTPException(422, "Conversation history is invalid") from None
    clean = None
    if frame is not None:
        require_consent(db, farmer, "agronomic_analysis")
        try:
            clean, *_ = sanitize_image(frame.file.read(8 * 1024 * 1024 + 1), frame.content_type)
        except (ValueError, UnidentifiedImageError, Image.DecompressionBombError, OSError):
            raise HTTPException(422, "The camera picture could not be read. Please try again.") from None
        finally:
            frame.file.close()
    quotas = request.app.state.v2_quotas
    quotas.check("live_user", str(farmer.id), 40, 3600)
    quotas.check("assistant_user_day", str(farmer.id), 120, 86400)
    quotas.check("assistant_ip", client_ip(request), 10, 60)
    quotas.check("assistant_global", "all", positive_env("SARVAM_CHAT_DAILY", 3000), 86400)
    facts = gather_facts(db, farmer, plot_id)
    crop_id = field_crop(db, plot_id) if plot_id else None
    owner = farmer.id
    db.commit()
    camera = None
    if clean is not None:
        quotas.check("images_global", "global", 2000, 86400)
        camera = await run_in_threadpool(look, clean, crop_id) if crop_id else {"status": "needs_crop"}
        facts["camera"] = {
            key: camera.get(key) for key in ("status", "likely_problem", "cause", "urgent", "first_steps")
        }
    sight = (
        CAMERA if camera else "The farmer did not show a picture this time. Ask them to point the camera at one leaf."
    )
    messages = [{"role": "system", "content": system_prompt(code, facts, sight)}]
    for item in turns:
        messages.append({"role": "user" if item.role == "farmer" else "assistant", "content": item.text})
    messages.append({"role": "user", "content": question})
    answer, action = parse_reply(await complete(messages))
    current, _ = authenticate(db, request)
    if current.id != owner:
        raise HTTPException(403, "Account changed during the question")
    require_consent(db, current, "speech_processing")
    return {
        "answer": answer,
        "action": action,
        "camera": camera,
        "language": code,
        "vision": "krishyak_leaf_model",
        "retention": "not_stored",
    }
