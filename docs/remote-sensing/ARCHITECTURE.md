# Field Intelligence architecture

Existing architecture audited before edits: React 18/Vite, custom lazy locale
loading and deferred screens; FastAPI/Pydantic 2, httpx, in-memory rate limiter,
file-backed soil/pest stores. Registration is a browser session, with safe local
draft/guest data. Farm inputs and versioned simulation cache are separate.
Weather, soil, pests, fertilizer, yield, cost, risk, market and recommendations
remain in their existing modules. No field-boundary catalog/database existed.
The map therefore reuses crop/area/place context and explicitly saves one local
boundary; it does not overwrite profile area or introduce server persistence.

```
Deferred Field Intelligence → device permission / optional marked field
  → remote-sensing router (bounded/redacted Pydantic input)
  → geometry validation / WGS84 geodesic area
  → service (cache / per-client + process quota / concurrency)
  → RemoteSensingProvider
     → CDSE OAuth token cache
     → Catalog candidates / Statistical series / Process masked PNG
  → observation/provenance → chart, map, ground-check actions
```

`backend/remote_sensing` contains schemas, geometry, quality, indices, cache,
service, router, trusted evalscripts and provider interface. CDSE is the only
active adapter. Bhoonidhi/SAR/classification/batch are documented extensions,
not misleading executable stubs. Capability flags for these are false.
`healthcheck` is configuration health, not a live credential validation claim.

Default series: 90 days, 10-day intervals; allow 5/10 days, maximum 180 days.
GPS first loads weather/climate and optional coarse place/region reports.
Accuracy ≤100 m permits automatic EO over a labelled 200 m neighbourhood,
preserved as spatial_scope=device_neighborhood in JSON and PNG. This is not
cadastral inference. Marked fields require explicit analysis. Numeric coordinate
entry is advanced-only; late GPS cannot overwrite the user's selected polygon.
Catalog pagination: at most 3×100 candidates, with truncation disclosed.
Preview: one catalog candidate day, quality checked first, then Process PNG.
Masks use SCL vegetation/bare soil only (4/5); everything else is excluded.
Source dataMask distinguishes available pixels from outside-field/no-data.
Independent per-output masks retain available and clear sample counts. Field
validity is conservatively `min(clear/available, clear/nominal_field_pixels)`;
nominal pixels use geodesic area / resolution². This coverage estimate is
approximate at grid edges, and is labelled estimated in the UI.

Service work is executed in a thread pool. HTTP connections and OAuth tokens
are reused; token lock prevents concurrent token storms. Identical cache misses
use a bounded striped-lock pool. Cache has TTL, item count and byte bounds and
returns isolated copies. Cache keys include provider, collection, geometry
digest, operation, layer/index, period, cloud setting, dimensions and version.
No cache files, secret values, or raw AOIs are logged. Requests are POST bodies,
not geometry-bearing URLs. Source errors never echo provider bodies.

No remote signal enters simulation/yield/profit/risk equations. The structured
`remote_sensing_context` is observation-only. A reserved influence flag exposes
requested state for administrators but actual influence remains false even if
set true; there is no scientifically validated model to enable.

## Threat model and operational bounds

- One exterior WGS84 Polygon, ≤200 input vertices, no self-intersection,
  holes, multipart, duplicate vertices, antimeridian or polar fields.
- Area: 100 m² to configurable maximum ≤500 ha. Coordinate span ≤0.25°;
  bounding raster footprint ≤100,000 nominal 10 m pixels. Skinny sprawling
  polygons cannot evade resource limits through small area.
- Request body ≤32 KiB and 10-second upload deadline; date range ≤180 days;
  no future end; PNG ≤768² pixels. OpenAPI includes bounded request schemas.
- At most 2 processing requests concurrently per process; 6 misses/IP/min,
  60/IP/day, 30/global/min, 300/global/day defaults. Existing general limiter
  also applies. Cached requests do not consume new EO processing allowance.
- Fixed HTTPS provider URLs; redirects rejected. Catalog continuation uses
  tokens, never provider-supplied URLs. No arbitrary evalscript or file upload.
- Responses bounded to 6 MiB before buffering. PNG signature/mode/dimensions
  and alpha checked. Provider dates/counts/numbers validated; malformed data
  fails with a controlled error rather than a fabricated number.
- 429 respects CDSE's documented millisecond Retry-After; long waits are
  returned as conventional seconds to the browser. Retry at most twice for
  safe read-only POSTs/5xx; 401 reacquires once; no infinite timeout retries.
- React renders metadata as text, not HTML. Only fixed official source URLs
  are emitted by the backend. Location requests are user initiated.

Limits/cache are per worker and reset on restart. They are pilot protections,
not account-wide budget enforcement across replicas/serverless invocations.
Before enabling an anonymous production deployment, configure a shared
gateway limiter and provider-account quota/monitoring. A district/state
workload needs a queue, batch/openEO/contracted research backend, object storage
and precomputed assets; it is rejected by these synchronous field endpoints.

See [ADR](../adr/ADR-remote-sensing-provider.md), [research](PROVIDER_RESEARCH.md),
[scientific limits](SCIENTIFIC_LIMITATIONS.md), and [setup](SETUP.md).

ClimateService independently retrieves ERA5 at rounded 0.1° coordinates, fixed
1991–2020 dates and two variables; 20-second read timeout/2 MiB cap; complete
day/unit validation; seven-day small-response cache and separate pilot quotas.
No raw daily array or point is returned. PlaceService is optional/default off:
rounded 0.01° requests, fixed URL/identified User-Agent, one in-flight call and
1.05 s pacing, 256 KiB cap, daily normalized cache and no precise location in
outputs. Public Nominatim remains disabled on replicas without shared pacing.
Frontend strips reporting identities/positions/photos/descriptions and filters
the selected crop. Sources fail independently; no inference replaces missing
soil, historical outbreak or crop-classification data. PNG text metadata carries
scope/quality/computation/cache provenance without geometry.
