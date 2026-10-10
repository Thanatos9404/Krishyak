# ADR: field-scale remote sensing

Date: 2026-09-30. Status: accepted for implementation; credentialed pilot verification required.

Use Copernicus Data Space Ecosystem (CDSE) Sentinel Hub Catalog, Process and
Statistical REST APIs behind a provider interface. Start with Sentinel-2 L2A.
Use server-only OAuth client credentials, field-specific SCL masks, compressed
PNG overlays and parcel statistics. Avoid raster downloads/GDAL and a new database.
Use MapLibre GL JS in a deferred screen, with a configurable OpenFreeMap style.

The existing FastAPI/httpx and React/Vite app fits this approach. Earth Engine
is a research option, subject to eligibility/commercial licensing. Bhoonidhi
is an India-relevant extension requiring approved API access and a processing
pipeline; it is not a working imagery/statistics adapter in this release.
Raw STAC/COG processing would add raster runtime, storage and deployment complexity.

CDSE general-user quota is finite and is not a production SLA. In-memory caches
and limits are per worker; production replicas require a shared gateway limiter.
Use the new 2026 /process/v1, /statistics/v1 and /catalog/v1 paths.

Observations cannot change yield, risk, cost or profit. The decision-influence
flag remains false and enabling it does not enable an unvalidated model.
SAR/classification/batch capabilities are false until implemented and verified.

Official links and comparison: [provider research](../remote-sensing/PROVIDER_RESEARCH.md).
Baseline: 149 backend and 220 frontend tests passed; lint/build passed.
Initial JS: 822.96 kB / 238.57 kB gzip. Existing warning: chunk over 500 kB;
backend warning: deprecated Pillow getdata in training utility.
