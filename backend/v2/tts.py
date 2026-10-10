"""Private read-aloud providers. No disk retention, guessed voices or paid retries."""

import asyncio
import base64
import binascii
import hashlib
import io
import json
import os
import time
import wave
from collections import OrderedDict
from typing import Protocol

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from sarvam_service import LANGUAGES, TTS_LANGUAGES, language_code
from speech_limits import positive_env

MAX_RESPONSE = 4 * 1024 * 1024
CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"
COMPUTE_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline"


class ReadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    text: str = Field(min_length=1, max_length=2500)
    language: str = Field(min_length=2, max_length=16)


async def bounded_post(url, *, headers, payload=None, files=None, data=None, limit=MAX_RESPONSE):
    try:
        async with asyncio.timeout(25):
            return await _bounded_post(url, headers=headers, payload=payload, files=files, data=data, limit=limit)
    except TimeoutError:
        raise HTTPException(503, "Speech service unavailable") from None


async def _bounded_post(url, *, headers, payload, files, data, limit):
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25, connect=5), follow_redirects=False) as client:
            arguments = {"files": files, "data": data} if files is not None else {"json": payload}
            async with client.stream("POST", url, headers=headers, **arguments) as response:
                if response.status_code == 429:
                    raise HTTPException(429, "Speech usage limit reached; retry later")
                if response.status_code != 200:
                    raise HTTPException(503, "Speech service unavailable")
                if "application/json" not in response.headers.get("content-type", ""):
                    raise HTTPException(502, "Invalid speech response")
                data = bytearray()
                async for chunk in response.aiter_bytes():
                    data.extend(chunk)
                    if len(data) > limit:
                        raise HTTPException(502, "Speech response too large")
        value = json.loads(data)
        if not isinstance(value, dict):
            raise ValueError()
        return value
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Speech service unavailable") from None


def validate_audio(audios):
    if not isinstance(audios, list) or len(audios) != 1 or not isinstance(audios[0], str):
        raise HTTPException(502, "Invalid speech audio")
    try:
        if len(audios[0]) > MAX_RESPONSE:
            raise ValueError()
        raw = base64.b64decode(audios[0], validate=True)
        with wave.open(io.BytesIO(raw), "rb") as audio:
            if (
                audio.getnchannels() not in (1, 2)
                or audio.getsampwidth() not in (1, 2, 3, 4)
                or not 8000 <= audio.getframerate() <= 48000
                or not 0 < audio.getnframes() / audio.getframerate() <= 180
                or len(audio.readframes(audio.getnframes()))
                != audio.getnframes() * audio.getnchannels() * audio.getsampwidth()
            ):
                raise ValueError()
    except (ValueError, binascii.Error, wave.Error, EOFError, ZeroDivisionError):
        raise HTTPException(502, "Invalid speech audio") from None
    return {"audios": audios, "mime_type": "audio/wav"}


def pipeline_configuration(result):
    """Parse the documented response without trusting nested provider types."""
    try:
        endpoint = result["pipelineInferenceAPIEndPoint"]
        auth = endpoint["inferenceApiKey"]
        if endpoint["callbackUrl"] != COMPUTE_URL or auth["name"].lower() != "authorization":
            raise ValueError()
        token = auth["value"]
        if not isinstance(token, str) or not token or len(token) > 4096 or "\r" in token or "\n" in token:
            raise ValueError()
        tasks = result["pipelineResponseConfig"]
        if not isinstance(tasks, list) or len(tasks) > 64:
            raise ValueError()
        choices = {}
        for task in tasks:
            if task["taskType"] != "tts":
                continue
            items = task["config"]
            if not isinstance(items, list) or len(items) > 128:
                raise ValueError()
            for item in items:
                code = item["language"]["sourceLanguage"]
                service = item["serviceId"]
                voices = item.get("supportedVoices", [])
                if not isinstance(voices, list):
                    raise ValueError()
                if isinstance(code, str) and code in LANGUAGES and isinstance(service, str) and 0 < len(service) < 256:
                    voice = next((value for value in voices if value in ("female", "male")), None)
                    if voice:
                        choices.setdefault(
                            code, {"serviceId": service, "gender": voice, "language": {"sourceLanguage": code}}
                        )
        return {"choices": choices, "token": token}
    except (KeyError, TypeError, AttributeError, ValueError):
        raise HTTPException(502, "Invalid speech configuration") from None


class TtsProvider(Protocol):
    name: str
    model: str

    async def languages(self) -> list[str]: ...

    async def synthesize(self, text: str, language: str) -> dict: ...


class SarvamTtsProvider:
    name = "sarvam"
    model = "bulbul:v3:shubh"

    async def languages(self):
        return list(TTS_LANGUAGES) if os.getenv("SARVAM_API_KEY", "").strip() else []

    async def synthesize(self, text, language):
        result = await bounded_post(
            "https://api.sarvam.ai/text-to-speech",
            headers={"api-subscription-key": os.getenv("SARVAM_API_KEY", "")},
            payload={
                "text": text,
                "language_code": language_code(language, tts=True),
                "model": "bulbul:v3",
                "speaker": "shubh",
                "pace": 0.9,
                "speech_sample_rate": 24000,
                "output_audio_codec": "wav",
            },
        )
        return validate_audio(result.get("audios"))


class BhashiniTtsProvider:
    name = "bhashini"
    model = "ulca-configured-pipeline"

    def __init__(self):
        self.config = None
        self.expires = 0
        self.identity = None
        self.failed_until = 0
        self.lock = asyncio.Lock()

    def credentials(self):
        values = tuple(
            os.getenv(name, "").strip() for name in ("BHASHINI_USER_ID", "BHASHINI_API_KEY", "BHASHINI_PIPELINE_ID")
        )
        hosted = os.getenv("VERCEL") == "1" or os.getenv("RENDER") == "true"
        production = os.getenv("ENVIRONMENT", "production" if hosted else "development") == "production"
        if os.getenv("BHASHINI_TTS_ENABLED", "false").lower() != "true" or not all(values):
            return None
        if production and os.getenv("BHASHINI_PRODUCTION_APPROVED", "false").lower() != "true":
            return None
        return values

    async def configuration(self):
        credentials = self.credentials()
        if not credentials:
            return {}
        identity = hashlib.sha256("\0".join(credentials).encode()).hexdigest()
        async with self.lock:
            if self.config and self.expires > time.monotonic() and identity == self.identity:
                return self.config
            if identity == self.identity and self.failed_until > time.monotonic():
                raise HTTPException(503, "Speech service unavailable; retry later")
            self.identity = identity
            self.config = None
            user, key, pipeline = credentials
            try:
                result = await bounded_post(
                    CONFIG_URL,
                    headers={"userID": user, "ulcaApiKey": key},
                    payload={"pipelineTasks": [{"taskType": "tts"}], "pipelineRequestConfig": {"pipelineId": pipeline}},
                    limit=256 * 1024,
                )
                self.config = pipeline_configuration(result)
            except HTTPException:
                self.failed_until = time.monotonic() + 30
                raise
            self.failed_until = 0
            self.expires = time.monotonic() + 600
            return self.config

    async def languages(self):
        try:
            return list((await self.configuration()).get("choices", {}))
        except HTTPException:
            return []

    async def synthesize(self, text, language):
        config = await self.configuration()
        choice = config.get("choices", {}).get(language)
        if not choice:
            raise HTTPException(422, "Speech unavailable for the selected language")
        result = await bounded_post(
            COMPUTE_URL,
            headers={"Authorization": config["token"]},
            payload={
                "pipelineTasks": [{"taskType": "tts", "config": choice}],
                "inputData": {"input": [{"source": text}]},
            },
        )
        try:
            tasks = result["pipelineResponse"]
            if len(tasks) != 1 or tasks[0]["taskType"] != "tts" or tasks[0]["config"]["audioFormat"] != "wav":
                raise ValueError()
            audios = [item["audioContent"] for item in tasks[0]["audio"]]
        except (KeyError, TypeError, ValueError):
            raise HTTPException(502, "Invalid speech audio") from None
        return validate_audio(audios)


class ReadAloud:
    def __init__(self):
        self.providers = (SarvamTtsProvider(), BhashiniTtsProvider())
        self.cache = OrderedDict()
        self.cache_bytes = 0
        self.active = set()
        self.cooldowns = {}

    async def capabilities(self):
        return {provider.name: await provider.languages() for provider in self.providers}

    async def synthesize(self, payload, request, owner):
        code = payload.language.split("-")[0].lower()
        code = "or" if code == "od" else code
        if code not in LANGUAGES:
            raise HTTPException(422, "Speech unavailable for the selected language")
        provider = None
        for item in self.providers:
            if code in await item.languages():
                provider = item
                break
        if provider is None:
            raise HTTPException(422, "Speech unavailable for the selected language")
        key = hashlib.sha256(
            "\0".join((str(owner), code, provider.name, provider.model, payload.text)).encode()
        ).hexdigest()
        now = time.monotonic()
        for expired in [key for key, value in self.cache.items() if value[0] <= now]:
            _, old = self.cache.pop(expired)
            self.cache_bytes -= len(old["audios"][0])
        if key in self.cache:
            return self.cache[key][1] | {"cached": True}
        if self.cooldowns.get(provider.name, 0) > now:
            raise HTTPException(503, "Speech service unavailable; retry later")
        if key in self.active or len(self.active) >= 2:
            raise HTTPException(429, "Speech service busy; retry later")
        quotas = request.app.state.v2_quotas
        quotas.check(
            "tts_user_characters",
            str(owner),
            positive_env("V2_TTS_USER_CHARACTERS_DAILY", 10000),
            86400,
            amount=len(payload.text),
        )
        quotas.check(
            "tts_global_characters",
            "all",
            positive_env("SARVAM_TTS_CHARACTERS_DAILY", 50000),
            86400,
            amount=len(payload.text),
        )
        self.active.add(key)
        try:
            async with asyncio.timeout(30):
                result = await provider.synthesize(payload.text, code)
        except (TimeoutError, HTTPException) as error:
            self.cooldowns[provider.name] = time.monotonic() + 30
            if isinstance(error, HTTPException):
                raise
            raise HTTPException(503, "Speech service unavailable") from None
        finally:
            self.active.discard(key)
        result |= {"provider": provider.name, "language": code, "model": provider.model}
        size = len(result["audios"][0])
        while self.cache and (self.cache_bytes + size > 8 * 1024 * 1024 or len(self.cache) >= 32):
            _, (_, old) = self.cache.popitem(last=False)
            self.cache_bytes -= len(old["audios"][0])
        self.cache[key] = (time.monotonic() + 120, result)
        self.cache_bytes += size
        return result | {"cached": False}
