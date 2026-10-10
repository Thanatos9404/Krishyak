"""Speech configuration helpers.

positive_env is shared by the v2 speech and read-aloud routes. reserve is the former
host-local quota for the removed unauthenticated /speech router; it has no runtime
caller and is kept only because test_private_tts.py patches sarvam_service.reserve.
"""
import hashlib
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
