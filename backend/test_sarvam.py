"""Shared Sarvam helper and offline locale-generation contracts.

The unauthenticated /speech router was removed; authenticated dictation and read
aloud are covered by test_v2_foundation.py and test_private_tts.py.
"""
import asyncio
import io
import os
import unittest
import wave
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

import sarvam_service as service
from generate_sarvam_locales import BATCH_MARKER, protect, restore


def wav():
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\x00\x00' * 160)
    return buffer.getvalue()


def upload(data, content_type):
    return UploadFile(io.BytesIO(data), filename='recording', headers=Headers({'content-type': content_type}))


class SpeechHelperTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {'SARVAM_API_KEY': 'test-only'})
        env.start()
        self.addCleanup(env.stop)

    def transcribe(self, data, content_type='audio/wav', language='en', transport=None):
        transport = transport or AsyncMock(return_value={'transcript': ' Rice two hectares '})
        return asyncio.run(service.transcribe_audio(upload(data, content_type), language, transport=transport)), transport

    def status(self, data, content_type='audio/wav', language='en'):
        transport = AsyncMock(return_value={'transcript': 'unused'})
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(service.transcribe_audio(upload(data, content_type), language, transport=transport))
        transport.assert_not_awaited()
        return raised.exception.status_code

    def test_batch_markers_allow_padding_without_losing_order(self):
        for prefix in ('90000000', '9000000000'):
            response = '\n'.join(f'[{prefix}{i}] label' for i in range(20))
            self.assertEqual([int(m.group(1)) for m in BATCH_MARKER.finditer(response)], list(range(20)))
        self.assertFalse(BATCH_MARKER.search('[123] ordinary number'))

    def test_language_mapping_and_unsupported_languages(self):
        self.assertEqual(service.language_code('or'), 'od-IN')
        self.assertEqual(service.language_code('od-IN', tts=True), 'od-IN')
        with self.assertRaises(HTTPException) as raised:
            service.language_code('sat', tts=True)
        self.assertEqual(raised.exception.status_code, 422)
        self.assertEqual(self.status(wav(), language='xx'), 422)

    def test_missing_key_does_not_call_provider(self):
        with patch.dict(os.environ, {'SARVAM_API_KEY': ''}):
            self.assertFalse(service.capabilities()['configured'])
            self.assertEqual(self.status(wav()), 503)

    def test_transcription_uses_native_language_and_never_invents_confidence(self):
        result, transport = self.transcribe(wav())
        self.assertEqual(result['transcript'], 'Rice two hectares')
        self.assertNotIn('confidence', result)
        self.assertEqual(transport.call_args.kwargs['data']['mode'], 'transcribe')
        self.assertEqual(transport.call_args.kwargs['data']['language_code'], 'en-IN')

    def test_audio_bounds_and_signatures_rejected_before_provider(self):
        self.assertEqual(self.status(b'hello', 'text/plain'), 415)
        self.assertEqual(self.status(b'not audio'), 415)
        self.assertEqual(self.status(b''), 413)
        self.assertEqual(self.status(b'x' * (service.MAX_AUDIO_BYTES + 1)), 413)

    def test_wave_truncation_rejected_before_provider(self):
        data = bytearray(wav())
        # WAV data chunk claims more frames than are present in the upload.
        data[40:44] = (64000).to_bytes(4, 'little')
        self.assertEqual(self.status(bytes(data)), 415)

    def test_invalid_provider_transcript_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            self.transcribe(wav(), transport=AsyncMock(return_value={'transcript': None}))
        self.assertEqual(raised.exception.status_code, 502)

    def test_placeholders_must_survive_exactly(self):
        source = 'Risk {{risk}} and {{risk}}'
        protected, mapping = protect(source)
        self.assertEqual(restore(protected, source, mapping), source)
        with self.assertRaises(ValueError):
            restore('missing', source, mapping)


if __name__ == '__main__':
    unittest.main()
