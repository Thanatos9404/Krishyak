"""Authenticated, ephemeral form dictation using the existing bounded provider."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from sarvam_service import LANGUAGES, api_key, capabilities, transcribe_audio
from security import client_ip

from .router import current_farmer, database, require_consent
from .tts import ReadRequest, bounded_post

router = APIRouter(prefix="/api/v2/speech", tags=["Private form dictation"])
SUPPORTED = set(LANGUAGES)


async def transcribe(request, file, language):
    # Private caller has already reserved distributed Redis usage. It must not
    # depend on the legacy endpoint's host-local SQLite quota database.
    async def transport(endpoint, *, files, data):
        return await bounded_post(
            "https://api.sarvam.ai/speech-to-text",
            headers={"api-subscription-key": api_key()},
            files=files,
            data=data,
            limit=1024 * 1024,
        )

    return await transcribe_audio(file, language, transport=transport)


@router.get("/capabilities")
async def speech_capabilities(request: Request, farmer=Depends(current_farmer)):
    result = capabilities()
    result["tts_providers"] = await request.app.state.v2_read_aloud.capabilities()
    result["tts_languages"] = sorted({code for codes in result["tts_providers"].values() for code in codes})
    return result | {
        "consent_required": "speech_processing",
        "retention": "no_persistent_storage",
        "tts_memory_cache_seconds": 120,
        "stt_audio_retention_seconds": 0,
    }


@router.post("/transcribe")
async def form_dictation(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form(..., max_length=16),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    require_consent(db, farmer, "speech_processing")
    if language.split("-")[0] not in SUPPORTED:
        raise HTTPException(422, "Select a supported language")
    if (file.content_type or "").split(";")[0] not in {"audio/wav", "audio/x-wav"}:
        await file.close()
        raise HTTPException(415, "Private dictation requires a bounded WAV recording")
    quotas = request.app.state.v2_quotas
    quotas.check("form_speech", str(farmer.id), 12, 3600)
    quotas.check("form_speech_ip", client_ip(request), 6, 60)
    quotas.check("form_speech_global", "all", 100, 86400)
    from speech_limits import positive_env

    quotas.check("stt_seconds_global", "all", positive_env("SARVAM_STT_SECONDS_DAILY", 3000), 86400, amount=30)
    # Release the farmer lock during external work, then check withdrawal/session
    # before returning the transcript. No audio or transcript is persisted.
    db.commit()
    result = await transcribe(request, file, language)
    from .auth import authenticate

    farmer, _ = authenticate(db, request)
    require_consent(db, farmer, "speech_processing")
    return result


@router.post("/synthesize")
async def private_read_aloud(
    payload: ReadRequest,
    request: Request,
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    require_consent(db, farmer, "speech_processing")
    quotas = request.app.state.v2_quotas
    owner = farmer.id
    quotas.check("tts_user", str(owner), 12, 3600)
    quotas.check("tts_ip", client_ip(request), 6, 60)
    quotas.check("tts_global", "all", 100, 86400)
    db.commit()
    result = await request.app.state.v2_read_aloud.synthesize(payload, request, owner)
    from .auth import authenticate

    current, _ = authenticate(db, request)
    if current.id != owner:
        raise HTTPException(403, "Account changed during speech processing")
    require_consent(db, current, "speech_processing")
    return result
