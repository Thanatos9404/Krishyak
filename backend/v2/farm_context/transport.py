"""Fixed destinations, bounded responses and deadlines. No request/body logging."""

import asyncio
import hashlib
import json
import logging
import time
from datetime import timedelta

import httpx

from remote_sensing.cache import TTLCache

from .models import Source, now

LOGGER = logging.getLogger(__name__)
ENDPOINTS = {
    "nominatim": "https://nominatim.openstreetmap.org/reverse",
    "open_meteo": "https://api.open-meteo.com/v1/forecast",
    "imd": "https://api.imd.gov.in/api/v1/cityforecastloc",
    "soilgrids": "https://rest.isric.org/soilgrids/v2.0/properties/query",
    "bhuvan": "https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms",
    "ogd": "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
}


class Unavailable(Exception):
    """Intentionally contains no upstream response, coordinates or credentials."""


class Gateway:
    def __init__(self, quotas, client_factory=None, clock=time.monotonic):
        self.quotas = quotas
        self.client_factory = client_factory or httpx.AsyncClient
        self.clock = clock
        self.cache = TTLCache(max_items=256, max_bytes=4 * 1024 * 1024, clock=clock)
        self.inflight = {}
        self.cooldown = {}
        self.last_health = {}
        self.next_call = {}
        self.request_slots = asyncio.Semaphore(4)

    async def pace(self, provider, interval):
        # SET NX with expiry enforces spacing across replicas, including window edges.
        redis = self.quotas.redis
        if redis is not None:
            try:
                accepted = await asyncio.to_thread(
                    redis.set, f"krishyak:public-provider:{provider}:pace", "1", nx=True, px=int(interval * 1000)
                )
            except Exception:
                raise Unavailable() from None
            if not accepted:
                raise Unavailable()
        elif self.quotas.settings.deployed:
            raise Unavailable()
        else:
            if self.clock() < self.next_call.get(provider, 0):
                raise Unavailable()
            self.next_call[provider] = self.clock() + interval

    async def read(self, provider, params, *, xml=False):
        if provider not in ENDPOINTS:
            raise Unavailable()
        if provider in {"nominatim", "soilgrids"}:
            await self.pace(provider, 1.1 if provider == "nominatim" else 12.1)
        started = self.clock()
        outcome = "unavailable"
        try:
            async with asyncio.timeout(9):
                async with self.request_slots:
                    async with self.client_factory(
                        timeout=httpx.Timeout(7, connect=3), follow_redirects=False
                    ) as client:
                        async with client.stream(
                            "GET",
                            ENDPOINTS[provider],
                            params=params,
                            headers={
                                "User-Agent": "Krishyak/2.0 (+https://krishyak.vercel.app)",
                                "Accept": "application/xml" if xml else "application/json",
                            },
                        ) as response:
                            if response.status_code != 200:
                                raise Unavailable()
                            content_type = response.headers.get("content-type", "").lower()
                            if (xml and not any(x in content_type for x in ("xml", "vnd.ogc.wms"))) or (
                                not xml and "json" not in content_type
                            ):
                                raise Unavailable()
                            size, parts = 0, []
                            async for chunk in response.aiter_bytes():
                                size += len(chunk)
                                if size > 2 * 1024 * 1024:
                                    raise Unavailable()
                                parts.append(chunk)
                            raw = b"".join(parts)
            result = raw if xml else json.loads(raw)
            outcome = "success"
            return result
        except (httpx.HTTPError, TimeoutError, ValueError, TypeError):
            raise Unavailable() from None
        finally:
            self.last_health[provider] = {"status": outcome, "checked_at": now().isoformat()}
            LOGGER.info(
                "farm_context provider=%s status=%s duration_ms=%d",
                provider,
                outcome,
                int((self.clock() - started) * 1000),
            )

    async def section(self, provider, key, loader, ttl, *, fallback=False, stale_seconds=0):
        # Cache identities contain no farmer ID or plaintext coordinates.
        digest = hashlib.sha256(json.dumps([provider, key], sort_keys=True).encode()).hexdigest()
        record = self.cache.get(digest)
        if record and self.clock() < record["fresh_until"]:
            return self.cached(record, provider, fallback, stale=False)
        if self.clock() < self.cooldown.get(provider, 0):
            return self.failure(record, provider, fallback)
        task = self.inflight.get(digest)
        if task is None:
            if len(self.inflight) >= 32:
                return self.failure(record, provider, fallback)
            task = asyncio.create_task(self.load(provider, digest, loader, ttl, stale_seconds))
            self.inflight[digest] = task
            task.add_done_callback(lambda done: self.inflight.pop(digest, None))
        try:
            value = await asyncio.shield(task)
            return self.cached(value, provider, fallback, stale=False, hit=False)
        except Unavailable:
            return self.failure(record, provider, fallback)

    async def load(self, provider, key, loader, ttl, stale_seconds):
        try:
            data = await loader()
            value = {
                "data": data.model_dump(mode="json") if hasattr(data, "model_dump") else data,
                "retrieved_at": now().isoformat(),
                "fresh_until": self.clock() + ttl,
                "valid_until": (now() + timedelta(seconds=ttl)).isoformat(),
            }
            self.cache.put(key, value, ttl + stale_seconds)
            self.cooldown.pop(provider, None)
            return value
        except Exception:
            # One provider failure cannot abort independently available sections.
            self.cooldown[provider] = self.clock() + 30
            raise Unavailable() from None

    def cached(self, record, provider, fallback, stale, hit=True):
        return {
            "data": record["data"],
            "source": Source(
                provider=provider,
                status="stale" if stale else "fallback" if fallback else "success",
                source_url=ENDPOINTS[provider],
                retrieved_at=record["retrieved_at"],
                valid_until=record["valid_until"],
                cache_hit=hit,
                is_fallback=fallback,
                message="Cached evidence has expired; refresh before acting" if stale else None,
            ),
        }

    def failure(self, record, provider, fallback):
        if record:
            return self.cached(record, provider, fallback, stale=True)
        return {
            "data": None,
            "source": Source(
                provider=provider,
                status="unavailable",
                source_url=ENDPOINTS[provider],
                is_fallback=fallback,
                message="This source is unavailable. Other sections remain usable.",
            ),
        }
