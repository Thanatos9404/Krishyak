"""Small opt-in paid integration check; prints no key or provider response bodies."""
import base64
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sarvam_service import router


def main():
    app = FastAPI(); app.include_router(router)
    with tempfile.TemporaryDirectory() as directory, patch.dict('os.environ', {
        'SARVAM_QUOTA_DB': str(Path(directory) / 'quota.sqlite3')
    }), TestClient(app) as client:
        response = client.post('/speech/synthesize', json={
            'text': 'Welcome to Krishyak. Rice cultivation on two hectares.', 'language': 'en'})
        print('TTS HTTP:', response.status_code, flush=True)
        if response.status_code != 200:
            print('TTS error:', response.json().get('detail')); return
        encoded = response.json()['audios'][0]
        repeat = client.post('/speech/synthesize', json={
            'text': 'Welcome to Krishyak. Rice cultivation on two hectares.', 'language': 'en'})
        print('Repeated audio cached:', repeat.json().get('cached'), flush=True)
        response = client.post('/speech/transcribe', files={
            'file': ('sample.wav', base64.b64decode(encoded), 'audio/wav')}, data={'language': 'en'})
        print('STT HTTP:', response.status_code, flush=True)
        if response.status_code == 200:
            print(json.dumps({'transcript': response.json()['transcript'], 'provider': response.json()['provider']}))
        else:
            print('STT error:', response.json().get('detail'))


if __name__ == '__main__':
    main()
