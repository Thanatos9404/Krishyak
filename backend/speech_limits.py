"""Persistent per-IP and global quotas for paid speech. No raw IPs or text stored."""
import hashlib
import asyncio
import os
import sqlite3
import time
from contextlib import closing
from pathlib import Path

from fastapi import HTTPException, Request


def positive_env(name, default):
    try:
        return max(1, int(os.getenv(name, default)))
    except ValueError:
        return default


def reserve(request: Request, characters=0):
    # Do not trust arbitrary X-Forwarded-For by default.
    ip = request.client.host if request.client else 'unknown'
    if os.getenv('TRUST_PROXY_HEADERS', 'false').lower() == 'true':
        ip = request.headers.get('x-forwarded-for', ip).split(',')[0].strip()
    identity = hashlib.sha256(ip.encode()).hexdigest()
    path = Path(os.getenv('SARVAM_QUOTA_DB', str(Path(__file__).parent / 'data' / 'speech_quotas.sqlite3')))
    now = int(time.time())
    limits = [
        ('ip:' + identity, 60, positive_env('SARVAM_IP_PER_MINUTE', 6), 0),
        ('ip:' + identity, 86400, positive_env('SARVAM_IP_PER_DAY', 60), 0),
        ('global', 60, positive_env('SARVAM_GLOBAL_PER_MINUTE', 20), 0),
        ('global', 86400, positive_env('SARVAM_GLOBAL_PER_DAY', 300),
         positive_env('SARVAM_TTS_CHARACTERS_PER_DAY', 200000)),
    ]
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(path, timeout=3)) as db, db:
            db.execute('CREATE TABLE IF NOT EXISTS quotas (identity TEXT, window INTEGER, bucket INTEGER, calls INTEGER, chars INTEGER, PRIMARY KEY(identity, window, bucket))')
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM quotas WHERE (bucket + 1) * window < ?', (now - 86400,))
            for who, window, max_calls, max_chars in limits:
                bucket = now // window
                row = db.execute('SELECT calls, chars FROM quotas WHERE identity=? AND window=? AND bucket=?', (who, window, bucket)).fetchone() or (0, 0)
                if row[0] >= max_calls or (max_chars and row[1] + characters > max_chars):
                    raise HTTPException(429, 'Speech usage limit reached. Please use text input or retry later.',
                                        headers={'Retry-After': str((bucket + 1) * window - now)})
                db.execute('INSERT INTO quotas VALUES (?, ?, ?, 1, ?) ON CONFLICT(identity, window, bucket) DO UPDATE SET calls=calls+1, chars=chars+excluded.chars', (who, window, bucket, characters))
    except (sqlite3.Error, OSError):
        # Never spend unmetered money if quota storage fails.
        raise HTTPException(503, 'Speech usage controls are temporarily unavailable.') from None


class SpeechBodyLimit:
    """Bound incoming speech bodies before multipart parsing or provider work."""
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not scope.get('path', '').startswith('/speech/') or scope.get('method') != 'POST':
            return await self.app(scope, receive, send)
        from starlette.responses import JSONResponse
        limit = 32768 if scope.get('path') == '/speech/synthesize' else 7 * 1024 * 1024
        chunks, size = [], 0
        while True:
            try:
                message = await asyncio.wait_for(receive(), timeout=15)
            except asyncio.TimeoutError:
                return await JSONResponse({'detail': 'Speech upload timed out.'}, status_code=408)(scope, receive, send)
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            size += len(chunk)
            if size > limit:
                return await JSONResponse({'detail': 'Speech request is too large.'}, status_code=413)(scope, receive, send)
            chunks.append(chunk)
            if not message.get('more_body', False):
                break
        delivered = False
        async def bounded_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': b''.join(chunks), 'more_body': False}
            return await receive()
        return await self.app(scope, bounded_receive, send)
