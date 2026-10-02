import logging
import io
import json
import math
import time
from datetime import datetime, timezone
from threading import Lock, Semaphore

from PIL import Image, PngImagePlugin

from rate_limiter import RateLimiter
from .cache import TTLCache, cache_key
from .config import Settings
from .geometry import area_details, bbox, geometry_hash
from .indices import INDICES, LIMITATIONS
from .providers.base import ProviderError
from .providers.copernicus import CopernicusSentinelHubProvider
from .quality import trend
from .schemas import Provenance

logger = logging.getLogger("krishyak.remote_sensing")


class RemoteSensingService:
    def __init__(self, settings=None, provider=None):
        self.settings = settings or Settings.from_env()
        self.provider = provider or CopernicusSentinelHubProvider(self.settings)
        self.cache = TTLCache()
        self.limiter = RateLimiter(self.settings.per_minute, self.settings.per_day)
        self.global_limiter = RateLimiter(30, self.settings.global_per_day, max_clients=1)
        self.slots = Semaphore(2)
        self.key_locks = [Lock() for _ in range(32)]

    def status(self):
        configured = self.settings.provider == "cdse" and self.provider.healthcheck()
        state = "disabled" if not self.settings.enabled else "ready" if configured else "not_configured"
        return {"status": state, "provider": self.settings.provider, "capabilities": self.provider.capabilities,
                "decision_influence": False, "decision_influence_requested": self.settings.decision_influence,
                "max_area_ha": self.settings.max_area_ha, "max_vertices": 200,
                "minimum_valid_fraction": .6, "indices": INDICES}

    def ensure_ready(self):
        if self.status()["status"] != "ready":
            raise ProviderError(self.status()["status"], "Remote sensing is disabled or needs server configuration", 503)

    def execute(self, operation, request, client_ip):
        self.ensure_ready()
        geometry = request.geometry.model_dump()
        area = area_details(geometry, self.settings.max_area_ha)
        bounds = bbox(geometry)
        lat = math.radians((bounds[1] + bounds[3]) / 2)
        # Do not process skinny polygons with excessive bounding-box pixel footprints.
        if (bounds[2] - bounds[0]) * 111320 * math.cos(lat) * (bounds[3] - bounds[1]) * 111320 / 100 > 100000:
            raise ValueError("Field raster extent too large for synchronous analysis")
        key = cache_key(self.settings.provider, operation, request)
        lock = self.key_locks[int(key[:8], 16) % len(self.key_locks)]
        start = time.monotonic()
        if not lock.acquire(timeout=1):
            raise ProviderError("busy", "A field request is already running; retry later", 429, 5)
        try:
            cached = self.cache.get(key)
            if cached is not None:
                if isinstance(cached, dict):
                    cached["provenance"]["cache_status"] = "hit"
                    if "remote_sensing_context" in cached:
                        cached["remote_sensing_context"]["source"]["cache_status"] = "hit"
                elif operation == "preview":
                    cached = self.image_provenance(cached, hit=True)
                self._log(operation, start, True, 200)
                return cached, True
            for limiter, identity in ((self.limiter, client_ip), (self.global_limiter, "global")):
                if not limiter.is_allowed(identity)[0]:
                    raise ProviderError("local_quota", "Satellite request limit reached; retry later", 429, 60)
            if not self.slots.acquire(blocking=False):
                raise ProviderError("busy", "Satellite processing is busy; retry later", 429, 5)
            try:
                if operation == "preview":
                    # Validate day quality first, rather than presenting a mostly-cloudy image.
                    spectral = "ndvi" if request.layer == "true_color" else request.layer
                    quality_request = request.model_copy(update={"index": spectral})
                    quality = self.provider.get_statistics(quality_request)
                    if not quality or quality[-1]["quality_status"] != "clear":
                        raise ProviderError("no_clear_observations", "Insufficient clear satellite observations", 404)
                    result = self.provider.get_visualization(request)
                    provenance = self.provenance(request, valid_fraction=quality[-1]["valid_fraction"])
                    # Attach evidence to the downloadable image without exposing geometry.
                    result = self.image_provenance(result, provenance=provenance)
                elif operation == "acquisitions":
                    result = {**self.provider.search_acquisitions(request), "area": area,
                              "provenance": self.provenance(request, composite=True)}
                else:
                    observations = self.provider.get_time_series(request)
                    latest = observations[-1] if observations else None
                    result = {"index": request.index, "area": area, "observations": observations,
                              "status": "clear" if latest and latest["quality_status"] == "clear" else "insufficient_data",
                              "trend": trend(observations), "provenance": self.provenance(request,
                                  valid_fraction=latest["valid_fraction"] if latest else None, composite=True)}
                    result["remote_sensing_context"] = {"status": result["status"], "latest_observation": latest,
                        "index": request.index, "trend": result["trend"], "source": result["provenance"],
                        "economic_influence": False}
                self.cache.put(key, result, self.settings.image_ttl if operation == "preview" else self.settings.cache_ttl)
                self._log(operation, start, False, 200)
                return result, False
            finally:
                self.slots.release()
        except ProviderError as exc:
            self._log(operation, start, False, exc.status)
            raise
        finally:
            lock.release()

    def provenance(self, request, valid_fraction=None, composite=True):
        index = getattr(request, "layer", request.index)
        definition = INDICES[index]
        return Provenance(provider=self.provider.name,
            spatial_scope=request.spatial_scope,
            requested_period={"from": request.start_date.isoformat(), "to": request.end_date.isoformat(),
                              "aggregation_days": request.interval_days},
            composite=composite, bands=definition["bands"] + ["SCL", "dataMask"], index=index,
            formula=definition["formula"], spatial_resolution_m=definition["resolution"],
            requested_geometry_hash=geometry_hash(request.geometry.model_dump()), valid_pixel_fraction=valid_fraction,
            computed_at=datetime.now(timezone.utc).isoformat(), limitations=LIMITATIONS).model_dump()

    @staticmethod
    def image_provenance(payload, provenance=None, hit=False):
        with Image.open(io.BytesIO(payload)) as image:
            metadata = provenance or json.loads(image.info["krishyak_provenance"])
            metadata["cache_status"] = "hit" if hit else "miss"
            info = PngImagePlugin.PngInfo()
            info.add_text("krishyak_provenance", json.dumps(metadata, separators=(",", ":")))
            output = io.BytesIO()
            image.save(output, format="PNG", pnginfo=info)
            return output.getvalue()

    def _log(self, operation, start, hit, status):
        logger.info("remote_sensing_request provider=%s operation=%s duration_ms=%.1f cache_hit=%s http_status=%s",
                    self.settings.provider, operation, (time.monotonic() - start) * 1000, hit, status)
