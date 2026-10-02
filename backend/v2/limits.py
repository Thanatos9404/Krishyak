"""Atomic distributed limits with a test/local-only in-memory fallback."""

import hashlib
import hmac
import time
from threading import Lock

from fastapi import HTTPException


class Quotas:
    def __init__(self, settings):
        self.settings = settings
        self.local = {}
        self.lock = Lock()
        self.redis = None
        if settings.redis_url.get_secret_value():
            from redis import Redis

            self.redis = Redis.from_url(
                settings.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=2
            )

    def check(self, category, identity, limit, seconds):
        bucket = int(time.time()) // seconds
        # Identifiers in Redis are digests, never plaintext phone numbers.
        identity_hash = hmac.new(
            self.settings.auth_secret.get_secret_value().encode(), identity.encode(), hashlib.sha256
        ).hexdigest()
        key = f"krishyak:v2:{category}:{identity_hash}:{bucket}"
        if self.redis is not None:
            try:
                count = self.redis.eval(
                    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
                    1,
                    key,
                    seconds + 1,
                )
            except Exception:
                raise HTTPException(503, "Usage controls unavailable; retry later") from None
        else:
            if self.settings.deployed:
                raise HTTPException(503, "Usage controls unavailable")
            with self.lock:
                now = time.time()
                self.local = {k: v for k, v in self.local.items() if v[1] > now}
                if key not in self.local and len(self.local) >= 10_000:
                    raise HTTPException(503, "Usage controls busy")
                count = self.local.get(key, (0, 0))[0] + 1
                self.local[key] = (count, now + seconds + 1)
        if count > limit:
            raise HTTPException(429, "Request limit reached; retry later", headers={"Retry-After": str(seconds)})
