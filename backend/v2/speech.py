"""Authenticated, ephemeral form dictation using the existing bounded provider."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from sarvam_service import capabilities, transcribe

from .router import current_farmer, database, require_consent

router = APIRouter(prefix="/api/v2/speech", tags=["Private form dictation"])
PILOT = set("en hi ur gu bn mr kn ta te ml pa".split())


@router.get("/capabilities")
def speech_capabilities(farmer=Depends(current_farmer)):
    result = capabilities()
    result["stt_languages"] = [code for code in result["stt_languages"] if code in PILOT]
    return result | {"consent_required": "speech_processing", "retention": "not_stored_by_krishyak"}


@router.post("/transcribe")
async def form_dictation(
    request: Request,
    file: UploadFile = File(...),
    language: str = Form(..., max_length=16),
    farmer=Depends(current_farmer),
    db=Depends(database, scope="function"),
):
    require_consent(db, farmer, "speech_processing")
    if language.split("-")[0] not in PILOT:
        raise HTTPException(422, "Select a supported pilot language")
    quotas = request.app.state.v2_quotas
    quotas.check("form_speech", str(farmer.id), 12, 3600)
    quotas.check("form_speech_global", "all", 100, 86400)
    # Release the farmer lock during external work, then check withdrawal/session
    # before returning the transcript. No audio or transcript is persisted.
    db.commit()
    result = await transcribe(request, file, language)
    from .auth import authenticate

    farmer, _ = authenticate(db, request)
    require_consent(db, farmer, "speech_processing")
    return result
