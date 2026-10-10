"""Provider fixtures exercise private read-aloud without spending credits."""

import base64
import io
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from test_sarvam import wav
from v2.limits import Quotas
from v2.settings import Settings
from v2.tts import (
    COMPUTE_URL,
    BhashiniTtsProvider,
    ReadAloud,
    ReadRequest,
    SarvamTtsProvider,
    pipeline_configuration,
    validate_audio,
)


class ReadAloudTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {"SARVAM_API_KEY": "fixture-only", "BHASHINI_TTS_ENABLED": "false"})
        self.environment.start()
        self.addCleanup(self.environment.stop)
        self.quotas = Quotas(Settings(auth_secret="fixture-only-" * 4))
        self.request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(v2_quotas=self.quotas)))
        self.audio = {"audios": [base64.b64encode(wav()).decode()], "mime_type": "audio/wav"}

    async def test_selected_language_mapping_and_private_hash_cache(self):
        service = ReadAloud()
        provider = service.providers[0]
        provider.synthesize = AsyncMock(return_value=dict(self.audio))
        payload = ReadRequest(text="खेत में पानी देखें", language="hi-IN")
        first = await service.synthesize(payload, self.request, "farmer-a")
        second = await service.synthesize(payload, self.request, "farmer-a")
        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])
        self.assertEqual(provider.synthesize.await_count, 1)
        self.assertNotIn(payload.text, str(list(service.cache)))
        await service.synthesize(payload, self.request, "farmer-b")
        self.assertEqual(provider.synthesize.await_count, 2)
        with patch("v2.tts.time.monotonic", return_value=10**12):
            await service.synthesize(payload, self.request, "farmer-b")
        self.assertEqual(provider.synthesize.await_count, 3)

    async def test_budget_and_missing_language_precede_provider(self):
        service = ReadAloud()
        provider = service.providers[0]
        provider.synthesize = AsyncMock(return_value=self.audio)
        with self.assertRaises(HTTPException) as raised:
            await service.synthesize(ReadRequest(text="text", language="sat"), self.request, "farmer")
        self.assertEqual(raised.exception.status_code, 422)
        with patch.dict(os.environ, {"SARVAM_TTS_CHARACTERS_DAILY": "2"}), self.assertRaises(HTTPException) as raised:
            await service.synthesize(ReadRequest(text="text", language="hi"), self.request, "farmer")
        self.assertEqual(raised.exception.status_code, 429)
        provider.synthesize.assert_not_awaited()

    async def test_outage_cooldown_has_no_automatic_paid_retry(self):
        service = ReadAloud()
        provider = service.providers[0]
        provider.synthesize = AsyncMock(side_effect=HTTPException(503, "Unavailable"))
        for _ in range(2):
            with self.assertRaises(HTTPException):
                await service.synthesize(ReadRequest(text="खेत देखें", language="hi"), self.request, "farmer")
        self.assertEqual(provider.synthesize.await_count, 1)
        self.assertFalse(service.active)

    async def test_sarvam_uses_documented_voice_and_validated_wav(self):
        with patch("v2.tts.bounded_post", AsyncMock(return_value=self.audio)) as transport:
            result = await SarvamTtsProvider().synthesize("ଖେତ", "or")
        self.assertEqual(result, self.audio)
        payload = transport.call_args.kwargs["payload"]
        self.assertEqual(payload["language_code"], "od-IN")
        self.assertEqual(payload["model"], "bulbul:v3")
        self.assertEqual(payload["speaker"], "shubh")

    async def test_bhashini_discovers_languages_rejects_ssrf_and_blocks_unapproved_production(self):
        environment = {
            "BHASHINI_TTS_ENABLED": "true",
            "BHASHINI_USER_ID": "fixture-user",
            "BHASHINI_API_KEY": "fixture-only",
            "BHASHINI_PIPELINE_ID": "fixture-pipeline",
            "ENVIRONMENT": "staging",
            "VERCEL": "",
            "RENDER": "",
            "BHASHINI_PRODUCTION_APPROVED": "false",
        }
        config = {
            "pipelineInferenceAPIEndPoint": {
                "callbackUrl": COMPUTE_URL,
                "inferenceApiKey": {"name": "Authorization", "value": "fixture-only"},
            },
            "pipelineResponseConfig": [
                {
                    "taskType": "tts",
                    "config": [
                        {
                            "language": {"sourceLanguage": "ur"},
                            "serviceId": "fixture-tts",
                            "supportedVoices": ["female"],
                        }
                    ],
                }
            ],
        }
        with patch.dict(os.environ, environment):
            provider = BhashiniTtsProvider()
            with patch("v2.tts.bounded_post", AsyncMock(return_value=config)) as transport:
                self.assertEqual(await provider.languages(), ["ur"])
                self.assertEqual(await provider.languages(), ["ur"])
                self.assertEqual(transport.await_count, 1)
            malicious = {**config, "pipelineInferenceAPIEndPoint": {"callbackUrl": "http://127.0.0.1/private"}}
            with patch("v2.tts.bounded_post", AsyncMock(return_value=malicious)):
                self.assertEqual(await BhashiniTtsProvider().languages(), [])
            with (
                patch.dict(os.environ, {"ENVIRONMENT": "production"}),
                patch("v2.tts.bounded_post", AsyncMock()) as transport,
            ):
                self.assertEqual(await provider.languages(), [])
                transport.assert_not_awaited()

    async def test_bhashini_compute_requires_one_wav_and_never_fetches_audio_uri(self):
        provider = BhashiniTtsProvider()
        provider.configuration = AsyncMock(
            return_value={
                "token": "fixture-only",
                "choices": {"ur": {"serviceId": "fixture", "gender": "female", "language": {"sourceLanguage": "ur"}}},
            }
        )
        response = {
            "pipelineResponse": [
                {
                    "taskType": "tts",
                    "config": {"audioFormat": "wav"},
                    "audio": [{"audioContent": self.audio["audios"][0], "audioUri": "http://private"}],
                }
            ]
        }
        with patch("v2.tts.bounded_post", AsyncMock(return_value=response)) as transport:
            self.assertEqual(await provider.synthesize("کھیت", "ur"), self.audio)
        self.assertEqual(transport.await_count, 1)
        self.assertEqual(transport.call_args.args[0], COMPUTE_URL)

    async def test_malformed_pipeline_and_config_outage_are_bounded(self):
        for payload in ({}, {"pipelineInferenceAPIEndPoint": None}, {"pipelineInferenceAPIEndPoint": []}):
            with self.subTest(payload=payload), self.assertRaises(HTTPException) as raised:
                pipeline_configuration(payload)
            self.assertEqual(raised.exception.status_code, 502)
        environment = {
            "BHASHINI_TTS_ENABLED": "true",
            "BHASHINI_USER_ID": "fixture-user",
            "BHASHINI_API_KEY": "fixture-key",
            "BHASHINI_PIPELINE_ID": "fixture-pipeline",
            "ENVIRONMENT": "staging",
        }
        with (
            patch.dict(os.environ, environment),
            patch("v2.tts.bounded_post", AsyncMock(side_effect=HTTPException(503, "Unavailable"))) as transport,
        ):
            provider = BhashiniTtsProvider()
            self.assertEqual(await provider.languages(), [])
            self.assertEqual(await provider.languages(), [])
            self.assertEqual(transport.await_count, 1)

    async def test_private_dictation_uses_bounded_transport_without_host_local_quota_storage(self):
        from v2.speech import transcribe

        recording = UploadFile(
            io.BytesIO(wav()), filename="fixture.wav", headers=Headers({"content-type": "audio/wav"})
        )
        with (
            patch("sarvam_service.reserve", side_effect=AssertionError("Legacy quota must not run")),
            patch(
                "v2.speech.bounded_post", AsyncMock(return_value={"transcript": "खेत", "language_code": "hi-IN"})
            ) as transport,
        ):
            result = await transcribe(self.request, recording, "hi")
        self.assertEqual(result["transcript"], "खेत")
        self.assertEqual(transport.call_args.args[0], "https://api.sarvam.ai/speech-to-text")
        self.assertEqual(transport.call_args.kwargs["limit"], 1024 * 1024)
        self.assertTrue(recording.file.closed)

    def test_invalid_audio_and_weighted_quota_fail_closed(self):
        for audios in ([], ["invalid"], [base64.b64encode(b"RIFFbadWAVE").decode()], self.audio["audios"] * 2):
            with self.assertRaises(HTTPException):
                validate_audio(audios)
        self.quotas.check("characters", "owner", 5, 60, amount=3)
        with self.assertRaises(HTTPException) as raised:
            self.quotas.check("characters", "owner", 5, 60, amount=3)
        self.assertEqual(raised.exception.status_code, 429)
        redis = Mock()
        redis.eval.side_effect = ConnectionError("private")
        self.quotas.redis = redis
        with self.assertRaises(HTTPException) as raised:
            self.quotas.check("characters", "owner", 5, 60, amount=3)
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(redis.eval.call_args.args[-1], 3)


if __name__ == "__main__":
    unittest.main()
