import base64
import io
import os
import tempfile
import unittest
import wave
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
import sarvam_service as service
from speech_limits import SpeechBodyLimit
from generate_sarvam_locales import protect, restore, BATCH_MARKER


def wav():
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(16000)
        audio.writeframes(b'\x00\x00' * 160)
    return buffer.getvalue()


class SpeechTests(unittest.TestCase):
    def test_batch_markers_allow_padding_without_losing_order(self):
        for prefix in ('90000000', '9000000000'):
            response = '\n'.join(f'[{prefix}{i}] label' for i in range(20))
            self.assertEqual([int(m.group(1)) for m in BATCH_MARKER.finditer(response)], list(range(20)))
        self.assertFalse(BATCH_MARKER.search('[123] ordinary number'))

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        env = patch.dict(os.environ, {'SARVAM_API_KEY': 'test-only',
            'SARVAM_QUOTA_DB': str(Path(self.temp.name) / 'quota.sqlite3'),
            'SARVAM_IP_PER_MINUTE': '6', 'SARVAM_GLOBAL_PER_MINUTE': '20',
            'SARVAM_GLOBAL_PER_DAY': '300', 'SARVAM_TTS_CHARACTERS_PER_DAY': '200000'})
        env.start(); self.addCleanup(env.stop)
        service._audio_cache.clear(); service._audio_cache_bytes = 0
        app = FastAPI(); app.include_router(service.router); app.add_middleware(SpeechBodyLimit)
        self.client = TestClient(app)

    def test_missing_key_and_unsupported_language_do_not_call_provider(self):
        with patch.dict(os.environ, {'SARVAM_API_KEY': ''}), patch.object(service, 'sarvam_request', new_callable=AsyncMock) as provider:
            self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'Hello'}).status_code, 503)
            self.assertFalse(self.client.get('/speech/capabilities').json()['configured'])
            provider.assert_not_called()
        self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'Hello', 'language': 'sat'}).status_code, 422)

    def test_odia_mapping_and_cache_prevent_repeat_tts_spend(self):
        with patch.object(service, 'sarvam_request', new_callable=AsyncMock, return_value={'audios': [base64.b64encode(wav()).decode()]}) as provider:
            payload = {'text': 'Hello', 'language': 'or'}
            first = self.client.post('/speech/synthesize', json=payload)
            second = self.client.post('/speech/synthesize', json=payload)
            self.assertEqual(first.status_code, 200)
            self.assertTrue(second.json()['cached'])
            self.assertEqual(provider.await_count, 1)
            self.assertEqual(provider.call_args.kwargs['json']['language_code'], 'od-IN')

    def test_transcription_uses_native_language_and_never_invents_confidence(self):
        with patch.object(service, 'sarvam_request', new_callable=AsyncMock, return_value={'transcript': 'Rice two hectares'}) as provider:
            response = self.client.post('/speech/transcribe', files={'file': ('a.wav', wav(), 'audio/wav')}, data={'language': 'en'})
            self.assertEqual(response.status_code, 200)
            self.assertNotIn('confidence', response.json())
            self.assertEqual(provider.call_args.kwargs['data']['mode'], 'transcribe')

    def test_quota_is_persistent_and_forwarded_header_cannot_bypass_it(self):
        with patch.dict(os.environ, {'SARVAM_IP_PER_MINUTE': '1', 'TRUST_PROXY_HEADERS': 'false'}), patch.object(service, 'sarvam_request', new_callable=AsyncMock, return_value={'transcript': 'Rice'}):
            kwargs = {'files': {'file': ('a.wav', wav(), 'audio/wav')}}
            self.assertEqual(self.client.post('/speech/transcribe', **kwargs).status_code, 200)
            blocked = self.client.post('/speech/transcribe', headers={'X-Forwarded-For': 'different'}, **kwargs)
            self.assertEqual(blocked.status_code, 429)
            self.assertIn('retry-after', blocked.headers)

    def test_global_character_budget_and_storage_failure_fail_closed(self):
        with patch.dict(os.environ, {'SARVAM_TTS_CHARACTERS_PER_DAY': '2'}), patch.object(service, 'sarvam_request', new_callable=AsyncMock) as provider:
            self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'Hello'}).status_code, 429)
            provider.assert_not_called()
        with patch.dict(os.environ, {'SARVAM_QUOTA_DB': self.temp.name}):
            self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'Hello'}).status_code, 503)

    def test_audio_and_text_bounds(self):
        self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'x' * 2501}).status_code, 422)
        self.assertEqual(self.client.post('/speech/synthesize', json={'text': '   '}).status_code, 422)
        self.assertEqual(self.client.post('/speech/transcribe', files={'file': ('a.txt', b'hello', 'text/plain')}).status_code, 415)
        self.assertEqual(self.client.post('/speech/transcribe', content=b'x' * (7*1024*1024+1)).status_code, 413)
        self.assertEqual(self.client.post('/speech/transcribe', files={'file': ('a.wav', b'not audio', 'audio/wav')}).status_code, 415)

    def test_cross_site_post_is_rejected_before_provider_spend(self):
        with patch.object(service, 'sarvam_request', new_callable=AsyncMock) as provider:
            self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'Hello'}, headers={'Origin': 'https://unrelated.example'}).status_code, 403)
            provider.assert_not_called()

    def test_invalid_provider_audio_is_not_cached(self):
        with patch.object(service, 'sarvam_request', new_callable=AsyncMock, return_value={'audios': ['invalid']}):
            self.assertEqual(self.client.post('/speech/synthesize', json={'text': 'Hello'}).status_code, 502)
            self.assertFalse(service._audio_cache)

    def test_placeholders_must_survive_exactly(self):
        source = 'Risk {{risk}} and {{risk}}'
        protected, mapping = protect(source)
        self.assertEqual(restore(protected, source, mapping), source)
        with self.assertRaises(ValueError): restore('missing', source, mapping)


if __name__ == '__main__':
    unittest.main()
