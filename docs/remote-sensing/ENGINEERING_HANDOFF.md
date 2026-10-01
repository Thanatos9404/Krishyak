# Field Intelligence engineering handoff

Local implementation: 1 October 2026 (India time), branch
`feature/krishyak-geoai-remote-sensing`. No deployment or commit was performed.

## Research and decision

Official research covered CDSE OAuth/Catalog/Process/Statistics, quotas and
rate semantics; Sentinel-2/Sentinel-1; openEO and batch scale; Earth Engine
access/pricing; AWS COGs; Bhoonidhi/NRSC/ISRO/NISAR access; MapLibre and basemap
licences; Indian/global farm platforms and public agricultural programmes.
The [research](PROVIDER_RESEARCH.md) and [ADR](../adr/ADR-remote-sensing-provider.md)
retain sources and decision criteria. CDSE is the active optical provider
because it offers server-side L2A masks, statistical aggregation and bounded
PNG processing without moving scenes into this app. SAR/Bhoonidhi remain
research extensions with false capability flags, not fake adapters.

The GPS follow-up checked Open-Meteo ERA5, ISRIC SoilGrids and public place
policies. Existing browser weather is reused with coarse requests; reverse
lookup has a cached/rate-controlled backend proxy, optional and default off
pending appropriate gateway configuration. ERA5 climate is independent of
CDSE. SoilGrids REST was reported paused; no soil type is invented.

## Implemented behaviour

- GPS-first location permission, nearby weather/place lookup, validated
  1991–2020 gridded climate and matching regional farmer reports; coordinate
  entry is advanced-only. Unknown soil/history/crop classification remain
  explicit unknowns, with links to soil, pest and crop-photo workflows.
- Accurate GPS automatically requests a labelled 200 m neighbourhood EO view,
  series and small preview when configured. Scope is device_neighborhood in
  provenance; it is not saved as a farm. No continuous location tracking.
- Deferred responsive map/route/chart; touch drawing/editing/undo/reset,
  map-free GeoJSON editor, authoritative WGS84 area and explicit local save.
- True colour, NDVI, NDMI and NDRE; conservative SCL/dataMask/denominator masks,
  validity gates, null gaps, robust area-relative trend, source/quality/date
  explanations and georeferenced PNG overlay. PNG downloads retain provenance.
- Typed redacted endpoints, fixed provider URLs/trusted scripts, cached OAuth,
  bounded retry/transport/response/geometry/time/output, cache/quota/concurrency,
  source metadata and safe operational logs.
- Existing profile crop/area/place reuse and inspection links; observation-only
  remote_sensing_context. No yield/profit/risk/fertilizer model changes.
- 116 feature strings in English plus all 22 existing languages, generated
  with the explicitly approved Sarvam service. Original packs are untouched.

## Files and dependencies

Created backend modules under `backend/remote_sensing/`: `__init__.py`,
`config.py`, `schemas.py`, `geometry.py`, `indices.py`, `quality.py`, `cache.py`,
`climate.py`, `place.py`, `service.py`, `router.py`, `providers/base.py`,
`providers/copernicus.py`, and seven trusted `evalscripts/*.js` (four previews,
three statistics). Created `backend/test_remote_sensing.py`,
`backend/test_remote_sensing_climate.py`, `backend/verify_remote_sensing_locales.py`.
Also created `backend/test_remote_sensing_place.py` and analytic trusted-script
tests `frontend/src/utils/remoteSensingEvalScripts.test.js`.
Changed backend router registration, requirements, `.env.example` and additive
translation-generator source/output options.

Created frontend API clients `remoteSensingApi.js` / `locationContextApi.js`
(plus context tests); `FieldIntelligence.jsx`/tests, `FieldMap.jsx`,
`FieldTrendChart.jsx`; remote-sensing utils/tests; sample polygon;
`remoteSensingLocales.js`/tests; 23 namespace JSON packs and 22 metadata files.
Changed App/navigation, Sidebar/AccordionSection focus targets, Dashboard pest
anchor, logout cleanup, I18nProvider additive loading, scoped CSS, weather API
optional accuracy/cancellation/redacted errors, Vite public map setting and
package/lock/example-env files. README and this documentation set are added
or updated. Temporary verification files are ignored under `.codex-tmp`.
The public `frontend/public/third-party-maplibre-license.txt` retains the full
MapLibre redistribution notice for the compiled browser bundle.

| New direct dependency | Version | Purpose |
|---|---|---|
| MapLibre GL | 6.11.2 | Open map, field corners and image overlay; BSD-3-Clause |
| Shapely | 2.1.2 | Robust polygon validity; BSD-3-Clause |
| GeographicLib | 2.1 | WGS84 ellipsoidal area; MIT |

MapLibre lockfile includes its transitive dependencies. Existing httpx, Pillow,
Pydantic, axios and Recharts are reused. No GDAL/rasterio/Earth Engine/ML runtime
is introduced. Source/usage attribution appears in map/image/context links.

## Configuration, running and deployment

New backend variables: REMOTE_SENSING_ENABLED (false),
REMOTE_SENSING_PROVIDER (cdse), CDSE_CLIENT_ID, CDSE_CLIENT_SECRET,
REMOTE_SENSING_DECISION_INFLUENCE (false; actual influence always false),
REMOTE_SENSING_MAX_AREA_HA (500), REMOTE_SENSING_CACHE_TTL (3600),
REMOTE_SENSING_IMAGE_TTL (1800), REMOTE_SENSING_IP_PER_MINUTE (6),
REMOTE_SENSING_IP_PER_DAY (60), REMOTE_SENSING_GLOBAL_PER_DAY (300).
Optional REMOTE_SENSING_PLACE_LOOKUP_ENABLED defaults false; enable only for
a deliberate small single-worker pilot or an appropriate shared gateway.
Frontend public VITE_MAP_STYLE_URL defaults to OpenFreeMap liberty. Existing
API/CORS deployment settings remain in use. Climate adds no required key/env.

Obtain server-only OAuth credentials from a CDSE account's Sentinel Hub
dashboard. Install backend requirements / `npm ci`, run uvicorn main:app with
backend app-dir and Vite at localhost:3000. Build frontend with `npm run build`;
use existing Vercel project roots/output and backend secrets/CORS. Full exact
commands, opt-in live smoke and licence/replica-limit caveats: [SETUP](SETUP.md).
Phone use: [mobile workflow](MOBILE_AND_PERFORMANCE.md). Keep EO disabled until
credentials and production provider/gateway limits are configured; missing
credentials do not stop mapping or other app features.

## Verification evidence

| Check | Baseline | Final |
|---|---:|---:|
| Backend full unittest | 149 passed | 196 ran: 195 passed, 1 intentional live-CDSE skip |
| Frontend Jest | 220 passed / 29 suites | 282 passed / 34 suites |
| New backend RS/context | — | 46 ran: 45 passed, 1 live skip |
| Lint + production build | Passed | Passed |
| Original/additive language verification | Original 22 passed | Both 22-language sets passed; feature 116 strings/language |
| Whitespace diff check | Clean | Clean |

Configured-secret scan checked five existing secret values against changed
text files without printing them: no matches. Documentation relative links
were checked for missing targets: none. No unrelated untracked artifact remains.

Offline tests cover geometry/area, invalid/date/output/script bounds, OAuth
reuse/concurrency/expiry/401/403, CDSE millisecond 429 semantics, 5xx/timeout,
empty/partial/cloudy/malformed statistics, PNG/alpha/provenance, normalized
cache/expiry/eviction, quota, trend boundaries, redaction/slow-body handling,
ready route contracts, full climate baseline/unit/day validation, GPS granted/
denied/imprecise/stale-response behaviour, explicit saving, layer cancellation,
offline summaries, source failures and translation coverage.

Jest selected-feature line coverage: 81.81% overall across FieldIntelligence,
remote utils and locationContextApi; page 78.8%, utils 91.42%, context 100%.
It does not measure WebGL, full-app coverage or scientific validity. stdlib
trace with thread tracing measured executable lines: Copernicus 89%, router
85%, place 93%, climate/service 95%, geometry 98% (selected modules; no branch measure).
No 100% coverage claim is made. Logs are ignored in `.codex-tmp/remote-sensing`.
The extra six Jest tests execute the fixed provider evalscripts against analytic
spectra and every excluded SCL class, including zero/negative/nonfinite input
handling. They test code/mask contracts, not real atmospheric correctness.

Main JS changed 822.96 → 828.70 kB, gzip 238.57 → 240.90 kB. Map is a separate
1,038.42 kB / 280.88 kB gzip opt-in chunk plus deferred worker/CSS. Existing
>500 kB warning remains. Detailed assets and responsive checks:
[MOBILE_AND_PERFORMANCE](MOBILE_AND_PERFORMANCE.md).

Live verified: OpenFreeMap style/tiles and production MapLibre worker; real
Open-Meteo current weather and Nominatim reverse lookup at the public sample;
real Open-Meteo ERA5 climate retrieval (10,958 valid days, 1991–2020, 26.62°C
mean daily temperature / 274.9 mm mean annual precipitation at the coarse
sample grid); Sarvam translation requests. These are not farmer measurements.
Browser GPS was emulated, EO series/images were offline fixtures, and climate
unavailability in a restricted fixture-server network was handled visibly.

The follow-up UI fixes remove the global amber crop/soil retry banner. Catalogs
recover automatically on reconnect or after 30 seconds. Registration accepts
typed crop names while catalog suggestions load, discards malformed draft field
types, normalizes keyboard whitespace and validates name/location lengths before
submission. A synthetic four-step registration was saved by the local API and
transitioned to the dashboard at 390 px. Live production Sarvam synthesis returned
valid WAV audio. Read-aloud resumes a Web Audio context synchronously on the tap
before fetching audio, preventing mobile autoplay rejection; tests cover delayed
decoding cancellation, playback failure cleanup and capability recovery.
The local browser received live Sarvam audio, decoded an 8.72-second WAV, started
it in a running audio context, and emitted its natural ended event. The button
returned to Read aloud with no alert, console error or mobile horizontal overflow.
This was desktop Chromium at a mobile viewport; physical iOS/Android audio testing
is still pending. Browser observations prove playback reached the audio engine,
not that sound was audited through a physical speaker.

**Not live verified:** CDSE OAuth, catalog, statistics or Process imagery,
because client credentials were absent. No Bhoonidhi/NISAR/openEO/EE calls or
scientific ground-truth validation. No physical-phone GPS/WebGL testing, native
translation review or live production deployment. The opt-in real CDSE smoke
is implemented and intentionally skipped until credentials are supplied.

## Limitations and next milestone

S2 resolution is 10/20 m, mask errors and mixed parcels matter; one-day and
multi-day most-recent mosaics have unverified contributing pixel timestamps.
Validity coverage is estimated; trends are unvalidated inspection cues. Phone
location is not field ownership; coarse climate is not local soil/weather
measurement. Satellite indices cannot identify crop/pest/disease or exact soil
nutrients. No historical government pest feed, soil map, crop-history dataset,
SAR adapter or joint disease model is presented as available. See
[SCIENTIFIC_LIMITATIONS](SCIENTIFIC_LIMITATIONS.md).

Known operational limits: per-worker in-memory quotas/cache, long synchronous
provider operations versus serverless duration caps, no shared account budget
enforcement, public place/weather API usage limits, large deferred map, native
language review and physical Android checks pending. Existing Pillow/Starlette
deprecation warnings remain. No failing final tests are hidden.

Recommended next milestone: a consented Rajasthan field pilot pairing surveyed
boundaries, crop/stage/management, lab soil records, weather, photographed and
expert-confirmed stress/disease observations with time-aligned Sentinel data.
Evaluate field/season/site holdouts, cloud masking, small-parcel bias and false
inspection alerts before any advisory/economic influence. Then assess SAR,
verified soil layers and crop classification as separate validated extensions.
[Research milestones](FUTURE_RESEARCH.md) retain the district-scale queue and
government/DST evidence roadmap.
