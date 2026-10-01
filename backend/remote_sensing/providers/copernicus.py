"""CDSE REST adapter. URLs/scripts are fixed; provider bodies are never exposed."""
import io
import math
import random
import time
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from threading import Lock

import httpx
from PIL import Image

from .base import ProviderError, RemoteSensingProvider
from ..geometry import bbox, area_details
from ..indices import INDICES, MIN_VALID_FRACTION, MIN_VALID_SAMPLES
from ..schemas import Observation

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
BASE_URL = "https://sh.dataspace.copernicus.eu"
SCRIPTS = Path(__file__).resolve().parents[1] / "evalscripts"


def time_range(request):
    return {"from": request.start_date.isoformat() + "T00:00:00Z",
            "to": (request.end_date + timedelta(days=1)).isoformat() + "T00:00:00Z"}


def retry_delay(value, milliseconds=False):
    try:
        seconds = float(value) / (1000 if milliseconds else 1)
    except (TypeError, ValueError):
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (TypeError, ValueError, OverflowError):
            seconds = 1
    return max(0, seconds) if math.isfinite(seconds) else 1


class CopernicusSentinelHubProvider(RemoteSensingProvider):
    name = "cdse"
    capabilities = {**RemoteSensingProvider.capabilities, "supports_optical": True,
                    "supports_statistics": True, "supports_timeseries": True}

    def __init__(self, settings, client=None, clock=time.monotonic, sleep=time.sleep):
        self.settings, self.clock, self.sleep = settings, clock, sleep
        self.client = client or httpx.Client(timeout=httpx.Timeout(20, connect=5),
            limits=httpx.Limits(max_connections=4, max_keepalive_connections=4), follow_redirects=False)
        self.token = None
        self.token_expiry = 0
        self.token_lock = Lock()

    def close(self):
        self.client.close()

    def healthcheck(self):
        # Configuration health only; never burns quota merely by opening the page.
        return bool(self.settings.client_id and self.settings.client_secret)

    @staticmethod
    def malformed():
        return ProviderError("malformed_response", "Satellite provider returned an invalid response", 502)

    def _json(self, response):
        try:
            value = response.json()
            if not isinstance(value, dict):
                raise ValueError()
            return value
        except (ValueError, TypeError):
            raise self.malformed() from None

    def _http(self, url, **kwargs):
        for attempt in range(3):
            try:
                with self.client.stream("POST", url, **kwargs) as response:
                    # Both provider JSON and PNG are bounded before buffering.
                    parts, length = [], 0
                    for chunk in response.iter_bytes():
                        length += len(chunk)
                        if length > 6 * 1024 * 1024:
                            raise self.malformed()
                        parts.append(chunk)
                    result = httpx.Response(response.status_code, headers=response.headers,
                                            content=b"".join(parts))
            except httpx.TimeoutException:
                raise ProviderError("timeout", "Satellite provider timed out; retry later", 504) from None
            except httpx.RequestError:
                raise ProviderError("unavailable", "Satellite provider is unreachable", 503) from None
            if result.status_code == 429:
                # Sentinel Hub documents numeric Retry-After in milliseconds.
                delay = retry_delay(result.headers.get("Retry-After"), milliseconds=url.startswith(BASE_URL))
                if attempt < 2 and delay <= 4:
                    self.sleep(delay + random.uniform(0, .2))
                    continue
                raise ProviderError("quota_exceeded", "Satellite quota is busy; retry later", 429,
                                    max(1, math.ceil(delay)))
            if result.status_code >= 500:
                if attempt < 2:
                    self.sleep(.25 * 2 ** attempt + random.uniform(0, .1))
                    continue
                raise ProviderError("provider_outage", "Satellite provider is temporarily unavailable", 503)
            return result

    def _get_token(self):
        with self.token_lock:
            if self.token and self.clock() < self.token_expiry:
                return self.token
            if not self.healthcheck():
                raise ProviderError("not_configured", "Remote sensing needs server credentials", 503)
            response = self._http(TOKEN_URL, data={"grant_type": "client_credentials",
                "client_id": self.settings.client_id, "client_secret": self.settings.client_secret})
            if response.status_code in (400, 401, 403):
                raise ProviderError("authentication", "Satellite credentials/access need administrator attention", 503)
            if response.status_code != 200:
                raise self.malformed()
            value = self._json(response)
            try:
                token, expires = value["access_token"], float(value["expires_in"])
                if not isinstance(token, str) or not token or not math.isfinite(expires) or expires <= 0:
                    raise ValueError()
            except (KeyError, ValueError, TypeError):
                raise self.malformed() from None
            self.token = token
            self.token_expiry = self.clock() + max(0, expires - min(60, expires / 2))
            return token

    def _post(self, path, body, accept="application/json"):
        token = self._get_token()
        response = self._http(BASE_URL + path, json=body,
                             headers={"Authorization": "Bearer " + token, "Accept": accept})
        if response.status_code == 401:
            # One fresh token retry. Do not invalidate a token another thread already refreshed.
            with self.token_lock:
                if self.token == token:
                    self.token_expiry = 0
            response = self._http(BASE_URL + path, json=body,
                headers={"Authorization": "Bearer " + self._get_token(), "Accept": accept})
        if response.status_code in (401, 403):
            raise ProviderError("access_denied", "Satellite access needs administrator attention", 503)
        if response.status_code != 200:
            raise self.malformed()
        return response

    def _input(self, request):
        return {"bounds": {"geometry": request.geometry.model_dump(),
            "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"}},
            "data": [{"type": "sentinel-2-l2a", "dataFilter": {"timeRange": time_range(request),
                "mosaickingOrder": "mostRecent", "maxCloudCoverage": request.max_cloud_percent},
                "processing": {"upsampling": "NEAREST", "downsampling": "NEAREST"}}]}

    def search_acquisitions(self, request):
        period = time_range(request)
        # Catalog uses inclusive upper bound; keep last midnight outside the selection.
        end = (datetime.fromisoformat(period["to"].replace("Z", "+00:00")) - timedelta(seconds=1)).isoformat()
        body = {"intersects": request.geometry.model_dump(), "collections": ["sentinel-2-l2a"],
                "datetime": period["from"] + "/" + end, "limit": 100,
                "filter": {"op": "<=", "args": [{"property": "eo:cloud_cover"}, request.max_cloud_percent]},
                "filter-lang": "cql2-json"}
        features, truncated = [], False
        for page in range(3):
            value = self._json(self._post("/catalog/v1/search", body))
            rows = value.get("features")
            if not isinstance(rows, list) or len(rows) > 100:
                raise self.malformed()
            try:
                for row in rows:
                    props = row["properties"]
                    timestamp = props["datetime"]
                    parsed = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                    if parsed.tzinfo is None or not request.start_date <= parsed.date() <= request.end_date:
                        raise ValueError()
                    cloud = props.get("eo:cloud_cover")
                    if cloud is not None and (not isinstance(cloud, (float, int)) or not math.isfinite(cloud) or not 0 <= cloud <= 100):
                        raise ValueError()
                    features.append({"id": str(row["id"])[:256], "acquired_at": timestamp,
                                     "scene_cloud_percent": cloud})
            except (KeyError, TypeError, ValueError, AttributeError):
                raise self.malformed() from None
            context = value.get("context", {})
            if not isinstance(context, dict):
                raise self.malformed()
            next_page = context.get("next")
            if next_page is None:
                break
            if not isinstance(next_page, (int, str)):
                raise self.malformed()
            body["next"] = next_page
            truncated = page == 2
        return {"acquisitions": sorted(features, key=lambda x: x["acquired_at"], reverse=True),
                "truncated": truncated, "scene_cloud_is_field_quality": False}

    def get_statistics(self, request):
        definition = INDICES[request.index]
        # Input CRS84 uses degrees, so explicitly convert nominal metres to degree spacing.
        # Pixel nominal resolution is approximate; source bands retain their 10/20 m limit.
        _, south, _, north = bbox(request.geometry.model_dump())
        lat = math.radians((south + north) / 2)
        resolution = definition["resolution"]
        body = {"input": self._input(request), "aggregation": {
            "timeRange": time_range(request), "aggregationInterval": {"of": f"P{request.interval_days}D", "lastIntervalBehavior": "SHORTEN"},
            "evalscript": (SCRIPTS / f"{request.index}_statistics.js").read_text(),
            "resx": resolution / (111320 * math.cos(lat)), "resy": resolution / 111320},
            "calculations": {"index": {"statistics": {"default": {"percentiles": {"k": [25, 50, 75]}}}}}}
        value = self._json(self._post("/statistics/v1", body))
        rows = value.get("data")
        if not isinstance(rows, list) or len(rows) > 37:
            raise self.malformed()
        observations = []
        try:
            intervals = set()
            for row in rows:
                period = row["interval"]
                start, end = period["from"], period["to"]
                lo, hi = (datetime.fromisoformat(t.replace("Z", "+00:00")) for t in (start, end))
                upper = datetime.combine(request.end_date + timedelta(days=1), datetime.min.time(), timezone.utc)
                if (lo.tzinfo is None or hi.tzinfo is None or not lo < hi
                    or not request.start_date <= lo.date() <= request.end_date or hi > upper
                    or (hi-lo).total_seconds() > request.interval_days * 86400 or start in intervals):
                    raise ValueError()
                intervals.add(start)
                if row.get("error"):
                    raise self.malformed()
                bands = row["outputs"]
                stats = bands["index"]["bands"]["B0"]["stats"]
                footprint = bands["footprint"]["bands"]["B0"]["stats"]
                # Footprint mask counts available source pixels, excluding outside-polygon
                # samples. Nominal area protects against partial source coverage/no-data.
                total = self._count(footprint["sampleCount"]) - self._count(footprint["noDataCount"])
                valid = self._count(stats["sampleCount"]) - self._count(stats["noDataCount"])
                if not 0 <= valid <= total:
                    raise ValueError()
                expected = area_details(request.geometry.model_dump())["square_metres"] / resolution ** 2
                available_fraction = valid / total if total else 0
                coverage = min(1, total / expected) if expected else 0
                fraction = min(available_fraction, valid / expected) if expected else 0
                quality = "clear" if fraction >= MIN_VALID_FRACTION and valid >= MIN_VALID_SAMPLES else "insufficient"
                normalized = {"start": start, "end": end, "sample_count": total, "valid_sample_count": valid,
                    "available_pixel_count": total, "nominal_pixel_count": expected,
                    "coverage_fraction_estimate": coverage, "valid_fraction_among_available": available_fraction,
                    "valid_fraction": fraction, "cloud_invalid_fraction": 1 - fraction, "quality_status": quality}
                for key, upstream in (("mean", "mean"), ("stdev", "stDev"), ("min", "min"), ("max", "max")):
                    normalized[key] = self._number(stats.get(upstream), signed=key != "stdev") if quality == "clear" else None
                if quality == "clear" and any(normalized[k] is None for k in ("mean", "stdev", "min", "max")):
                    raise ValueError()
                percentiles = stats.get("percentiles", {})
                for k in (25, 50, 75):
                    normalized[f"p{k}"] = self._number(percentiles.get(str(float(k)), percentiles.get(str(k)))) if quality == "clear" else None
                observations.append(Observation(**normalized).model_dump())
        except (KeyError, TypeError, ValueError, AttributeError):
            raise self.malformed() from None
        return sorted(observations, key=lambda x: x["start"])

    @staticmethod
    def _count(value):
        if isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError()
        return value

    @staticmethod
    def _number(value, signed=True):
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            raise ValueError()
        if not (-1.001 if signed else 0) <= value <= (1.001 if signed else 2):
            raise ValueError()
        return value

    def get_visualization(self, request):
        body = {"input": self._input(request), "output": {"width": request.width, "height": request.height,
            "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
            "evalscript": (SCRIPTS / f"{request.layer}.js").read_text()}
        response = self._post("/process/v1", body, accept="image/png")
        if not response.content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise self.malformed()
        try:
            with Image.open(io.BytesIO(response.content)) as img:
                if img.size != (request.width, request.height) or img.mode != "RGBA":
                    raise ValueError()
                img.verify()
            with Image.open(io.BytesIO(response.content)) as img:
                alpha = img.getchannel("A")
                if not alpha.getbbox():
                    raise ProviderError("no_clear_observations", "Insufficient clear satellite observations", 404)
        except ProviderError:
            raise
        except (OSError, ValueError, SyntaxError):
            raise self.malformed() from None
        return response.content
