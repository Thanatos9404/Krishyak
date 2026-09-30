"""Server-only Sarvam integration. UI translations are generated offline, not here."""
import asyncio
import base64
import binascii
import os
import io
import wave
from collections import OrderedDict
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, File, Form, HTTPException, UploadFile, Request, Depends
from pydantic import BaseModel, Field
from speech_limits import reserve, positive_env

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env')
BASE_URL = 'https://api.sarvam.ai'
LANGUAGES = tuple('en hi bn gu kn ml mr or pa ta te as brx doi kok ks mai mni ne sa sat sd ur'.split())
TTS_LANGUAGES = tuple('en hi bn gu kn ml mr or pa ta te'.split())
MAX_AUDIO_BYTES = 6 * 1024 * 1024
def check_origin(request: Request):
    origin = request.headers.get('origin')
    allowed = {item.strip() for item in os.getenv('CORS_ORIGINS', 'http://localhost:3000').split(',')}
    allowed.update({'https://krishyak.vercel.app', 'https://krishyak-yashvardhan-thanvis-projects.vercel.app'})
    if request.method == 'POST' and origin and origin not in allowed:
        raise HTTPException(403, 'Speech requests from this site are not allowed.')


router = APIRouter(prefix='/speech', tags=['Sarvam speech'], dependencies=[Depends(check_origin)])
# Bounded in-memory cache: no transcripts/audio written to disk. Restart clears it.
_audio_cache = OrderedDict()
_audio_cache_bytes = 0
_tts_lock = asyncio.Lock()
_active_calls = 0


def language_code(code: str, *, tts=False) -> str:
    base = code.split('-')[0].lower()
    base = 'or' if base == 'od' else base
    if base not in (TTS_LANGUAGES if tts else LANGUAGES):
        raise HTTPException(422, 'Sarvam does not support this language for this operation.')
    return ('od' if base == 'or' else base) + '-IN'


def api_key():
    key = os.getenv('SARVAM_API_KEY', '').strip()
    if not key:
        raise HTTPException(503, 'Sarvam speech is not configured on the server.')
    return key


async def sarvam_request(endpoint, **kwargs):
    global _active_calls
    key = api_key()
    if _active_calls >= positive_env('SARVAM_MAX_CONCURRENT', 3):
        raise HTTPException(429, 'Speech service is busy. Please retry later.')
    _active_calls += 1
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60, connect=10)) as client:
            response = await client.post(BASE_URL + endpoint,
                                         headers={'api-subscription-key': key}, **kwargs)
    except httpx.HTTPError:
        raise HTTPException(503, 'Sarvam is unreachable. Please retry or use text input.') from None
    finally:
        _active_calls -= 1
    if response.status_code == 429:
        raise HTTPException(429, 'Sarvam usage limit reached. Please retry later.')
    if response.status_code in (401, 403):
        raise HTTPException(503, 'Sarvam credentials or account access need attention.')
    if response.status_code >= 400:
        # Provider error bodies can contain submitted text; never reflect them.
        raise HTTPException(502, 'Sarvam could not process this request.')
    try:
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError()
        return result
    except ValueError:
        raise HTTPException(502, 'Sarvam returned an invalid response.') from None


@router.get('/capabilities')
def capabilities():
    return {'provider': 'sarvam', 'configured': bool(os.getenv('SARVAM_API_KEY', '').strip()),
            'stt_languages': LANGUAGES, 'tts_languages': TTS_LANGUAGES,
            'max_recording_seconds': 29, 'stt_model': 'saaras:v3', 'tts_model': 'bulbul:v3'}


@router.post('/transcribe')
async def transcribe(request: Request, file: UploadFile = File(...), language: str = Form('en')):
    code = language_code(language)
    api_key()
    reserve(request)
    try:
        data = await file.read(MAX_AUDIO_BYTES + 1)
    finally:
        await file.close()
    if not data or len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(413, 'Audio must be nonempty and at most 6 MB.')
    mime = (file.content_type or '').split(';')[0].strip().lower()
    extensions = {'audio/webm': 'webm', 'video/webm': 'webm', 'audio/mp4': 'm4a',
                  'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
                  'audio/mpeg': 'mp3'}
    if mime not in extensions:
        raise HTTPException(415, 'Unsupported audio format.')
    signatures = {
        'wav': data.startswith(b'RIFF') and data[8:12] == b'WAVE',
        'webm': data.startswith(b'\x1a\x45\xdf\xa3'),
        'ogg': data.startswith(b'OggS'),
        'm4a': b'ftyp' in data[:32],
        'mp3': data.startswith(b'ID3') or (len(data) > 1 and data[0] == 255 and data[1] & 224 == 224),
    }
    if not signatures[extensions[mime]]:
        raise HTTPException(415, 'Audio contents do not match the declared format.')
    if extensions[mime] == 'wav':
        try:
            with wave.open(io.BytesIO(data), 'rb') as audio:
                duration = audio.getnframes() / audio.getframerate()
                if duration > 30:
                    raise HTTPException(422, 'Recordings must be no longer than 30 seconds.')
        except (wave.Error, EOFError, ZeroDivisionError):
            raise HTTPException(415, 'Invalid WAV audio.') from None
    result = await sarvam_request('/speech-to-text',
        files={'file': ('recording.' + extensions[mime], data, mime)},
        data={'model': 'saaras:v3', 'mode': 'transcribe', 'language_code': code})
    text = result.get('transcript')
    if not isinstance(text, str) or len(text) > 10000:
        raise HTTPException(502, 'Sarvam returned an invalid transcript.')
    return {'transcript': text.strip(), 'language_code': result.get('language_code') or code,
            'provider': 'sarvam'}


class SpeechRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2500)
    language: str = Field(default='en', max_length=16)
    pace: float = Field(default=0.9, ge=0.5, le=2.0, allow_inf_nan=False)


@router.post('/synthesize')
async def synthesize(payload: SpeechRequest, request: Request):
    global _audio_cache_bytes
    code = language_code(payload.language, tts=True)
    text = payload.text.strip()
    if not text:
        raise HTTPException(422, 'Text cannot be blank.')
    api_key()
    reserve(request, len(text))
    key = (text, code, payload.pace)
    # Reject while a synthesis is in flight, then reuse completed identical audio.
    if _tts_lock.locked():
        raise HTTPException(429, 'Speech service is busy. Please retry later.')
    async with _tts_lock:
        if key in _audio_cache:
            _audio_cache.move_to_end(key)
            return {**_audio_cache[key], 'cached': True}
        result = await sarvam_request('/text-to-speech', json={
            'text': text, 'language_code': code, 'model': 'bulbul:v3', 'speaker': 'shubh',
            'pace': payload.pace, 'speech_sample_rate': 24000, 'output_audio_codec': 'wav'})
        audios = result.get('audios')
        if not isinstance(audios, list) or not audios or not all(isinstance(a, str) for a in audios):
            raise HTTPException(502, 'Sarvam returned no usable audio.')
        try:
            for audio in audios:
                decoded = base64.b64decode(audio, validate=True)
                if not decoded.startswith(b'RIFF') or decoded[8:12] != b'WAVE':
                    raise ValueError()
        except (ValueError, binascii.Error):
            raise HTTPException(502, 'Sarvam returned invalid audio.') from None
        value = {'audios': audios, 'mime_type': 'audio/wav', 'provider': 'sarvam'}
        size = sum(len(a) for a in audios)
        if size <= 16 * 1024 * 1024:
            while _audio_cache and (_audio_cache_bytes + size > 16 * 1024 * 1024 or len(_audio_cache) >= 64):
                _, evicted = _audio_cache.popitem(last=False)
                _audio_cache_bytes -= sum(len(a) for a in evicted['audios'])
            _audio_cache[key] = value
            _audio_cache_bytes += size
        return {**value, 'cached': False}
