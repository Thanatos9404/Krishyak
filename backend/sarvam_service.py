"""Shared Sarvam speech helpers for the authenticated v2 speech routes.

The unauthenticated legacy /speech router was removed; v2.speech and v2.tts own
consent, quotas and transport. UI translations are generated offline, not here.
"""
import io
import os
import wave
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException

# Retained only as a patch target for test_private_tts.py, which asserts the
# legacy host-local quota never runs for private dictation.
from speech_limits import reserve  # noqa: F401

load_dotenv(Path(__file__).parent / '.env')
load_dotenv(Path(__file__).parent.parent / '.env')
LANGUAGES = tuple('en hi bn gu kn ml mr or pa ta te as brx doi kok ks mai mni ne sa sat sd ur'.split())
TTS_LANGUAGES = tuple('en hi bn gu kn ml mr or pa ta te'.split())
MAX_AUDIO_BYTES = 6 * 1024 * 1024


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


def capabilities():
    return {'provider': 'sarvam', 'configured': bool(os.getenv('SARVAM_API_KEY', '').strip()),
            'stt_languages': LANGUAGES, 'tts_languages': TTS_LANGUAGES,
            'max_recording_seconds': 29, 'stt_model': 'saaras:v3', 'tts_model': 'bulbul:v3'}


async def transcribe_audio(file, language, *, transport):
    """Shared bounded validation; callers supply the transport and enforce their own usage budgets."""
    code = language_code(language)
    api_key()
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
                if duration <= 0 or duration > 30:
                    raise HTTPException(422, 'Recordings must be no longer than 30 seconds.')
                if len(audio.readframes(audio.getnframes())) != audio.getnframes() * audio.getsampwidth() * audio.getnchannels():
                    raise HTTPException(415, 'Invalid WAV audio.')
        except (wave.Error, EOFError, ZeroDivisionError):
            raise HTTPException(415, 'Invalid WAV audio.') from None
    result = await transport('/speech-to-text',
        files={'file': ('recording.' + extensions[mime], data, mime)},
        data={'model': 'saaras:v3', 'mode': 'transcribe', 'language_code': code})
    text = result.get('transcript')
    if not isinstance(text, str) or len(text) > 10000:
        raise HTTPException(502, 'Sarvam returned an invalid transcript.')
    return {'transcript': text.strip(), 'language_code': result.get('language_code') or code,
            'provider': 'sarvam'}
