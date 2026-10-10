# Remote sensing API

All routes use the existing `success` envelope. JSON responses include `data`;
failures include safe `code`/`error`. No provider body/token/polygon echo in
errors. Input limits are documented in ARCHITECTURE.md.

| Method / path | Input | Output |
|---|---|---|
| GET /remote-sensing/status | None | Config state, actual capabilities, limits, index metadata |
| POST /remote-sensing/geometry | GeoJSON Polygon | Normalized polygon, authoritative WGS84 area in m²/ha/acres/km²; works disabled |
| POST /remote-sensing/climate | latitude, longitude | ERA5 gridded 1991–2020 baseline; independent of CDSE |
| POST /remote-sensing/place | latitude, longitude | Optional coarse city/district/state/country and OSM source; default disabled |
| POST /remote-sensing/acquisitions | FieldRequest | Date-sorted catalog candidates, scene cloud %, truncation, area/provenance |
| POST /remote-sensing/timeseries | FieldRequest | Normalized index intervals, quality, trend, provenance/context |
| POST /remote-sensing/preview | PreviewRequest | Bounded alpha PNG; no raw multispectral raster/base64 |

FieldRequest example:
```json
{
  "geometry": {"type":"Polygon","coordinates":[[[73,26.8],[73.002,26.8],[73.002,26.802],[73,26.802],[73,26.8]]]},
  "start_date":"2026-01-01",
  "end_date":"2026-03-31",
  "index":"ndvi",
  "interval_days":10,
  "max_cloud_percent":100
}
```
Preview adds `layer` (true_color/ndvi/ndmi/ndre), `width`/`height` (64–768) and
requires start_date=end_date. Every image is a requested-day mosaic; do not
claim a catalog timestamp is a verified pixel acquisition. Scene cloud filter
is optional and is not field-quality validation. The UI leaves it at 100 to
avoid throwing away partly cloudy scenes that are clear over the parcel.

Each observation: start/end aggregation interval, mean/stdev/min/max/p25/p50/p75,
sample_count (available parcel samples), valid_sample_count,
available_pixel_count, nominal_pixel_count, coverage_fraction_estimate,
valid_fraction_among_available, valid_fraction (conservative estimated parcel
validity), cloud_invalid_fraction (includes all invalid/missing classes, **not**
a separately measured cloud-only fraction), quality_status.
Insufficient intervals return null scientific statistics, not zeros.

Provenance: evidence_type=remote_sensing_observation, provider/mission/collection,
L2A processing level, requested period, bands, index/formula/version, nominal
resolution and mask resolution, geometry hash, validity, computed_at, cache
hit/miss, official reference and limitations. Exact contributing dates are
explicitly unverified. `remote_sensing_context.economic_influence=false`.

Errors: 422 invalid request/geometry; 503 disabled/not_configured/authentication/
access_denied/provider_outage; 504 timeout; 429 local_quota/quota_exceeded/busy
(Retry-After seconds); 404 no_clear_observations for preview. Empty catalog/
series is successful no-data, not a provider outage. Image responses are
private/no-store; backend image cache is bounded and server-controlled.
PNG responses embed the same evidence schema in the `krishyak_provenance`
text chunk, including the quality gate's valid fraction, requested day,
unverified contributing timestamps and processing time. Cached PNG delivery
updates cache_status while preserving that computation time.

FieldRequest accepts spatial_scope=field (default) or device_neighborhood,
retained in JSON/PNG and cache identity. Location inputs are finite strict
numeric WGS84 `{"latitude":26.8,"longitude":73}`; no extra fields.
Climate fixes baseline/model/variables server-side and returns evidence type,
source, mean_temperature_c, mean_annual_precipitation_mm, baseline years,
valid_days (10,958), nominal_resolution_km (25), coordinate-rounding degree,
computed_at, cache status and limitations; no point or daily arrays. Complete
coverage/units are required. It is not a forecast or a soil/satellite observation.
Place rounds to 0.01° before external lookup and returns no position. Location
routes share bounded/redacted parsing. Errors: invalid 422, incomplete 502,
disabled/unavailable 503, timeout 504 or local pace/quota 429.
