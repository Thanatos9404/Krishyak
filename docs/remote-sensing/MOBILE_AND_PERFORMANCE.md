# Mobile and performance verification

Verified locally on 1 October 2026 (India time). Browser checks used Chromium
through agent-browser; viewport emulation is not physical Android testing.

| Viewport | Populated GPS-context screen / chart | Page overflow |
|---|---|---|
| 360 × 800 | Checked | None |
| 390 × 844 | Checked | None |
| 412 × 915 | Checked | None |
| 768 × 1024 | Checked; navigation overflow found and fixed | None after fix |
| 1440 × 1000 | Checked | None |

The real OpenFreeMap style, MapLibre canvas, four corner markers and attribution
loaded. Pointer clicks created a four-corner polygon in the production map.
The numerical fallback editor updated a corner at 390 px. The backend calculated
the sample's WGS84 area as 4.4067 ha without satellite credentials. GPS-first
entry used **emulated GPS** and an **offline satellite fixture**: summary,
masked-PNG transport, Blob image, scope label and real Recharts graph appeared
without entering coordinates. No boundary was saved automatically. Map assets
were absent until Open map, including during automatic standalone image viewing.
Native browser permission denial was also observed; the retry/map path remained.

Browser fixture images/statistics are not live satellite data. Weather/place
lookup for the public Rajasthan point succeeded against real Open-Meteo and
Nominatim. A separate real server-side climate smoke succeeded. Climate was
also unavailable under the restricted fixture-server network; the UI retained
other sources and honestly showed unavailable. No CDSE live calls were made.

## Phone workflow

1. Open Field Intelligence and allow phone location. Use HTTPS outside localhost.
2. Stand near the farm. Weather/climate/report context loads automatically.
3. With configured CDSE, a 90-day vegetation summary and 256² preview load
   automatically around the phone. This is a 200 m neighbourhood, not farm size.
4. For the farmer's actual field, Open map → Draw boundary → tap corners →
   Finish → Calculate field area / Analyze field. No coordinate knowledge needed.
5. Switch vegetation/moisture/red-edge signals; marked-field imagery loads only
   on explicit Load selected image. Advanced coordinate entry remains optional.
6. Use crop-photo, weather, soil or pest links to inspect causes. To save a
   marked boundary, explicitly Save. Delete/logout clears boundary and summary.

New controls have ≥44 px touch dimensions, visible keyboard focus, labelled
inputs, status/alert semantics, chart numerical fallback and a map-free editor.
Map navigation/marker hit areas were enlarged. No claim of formal accessibility
certification or physical-device GPS/battery validation is made.

## Bundle evidence

Vite production build (decimal kB), including lint:

| Asset | Baseline | Final | gzip |
|---|---:|---:|---:|
| Main JS | 822.96 | 828.70 | 238.57 → 240.90 |
| Field Intelligence page (lazy) | — | 23.76 | 7.17 |
| MapLibre map (lazy, only when opened) | — | 1,038.42 | 280.88 |
| Map worker (deferred) | — | 508.76 | Served compressed by host |
| Map CSS (lazy) | — | 82.96 | 10.72 |
| Field chart wrapper (lazy) | — | 11.77 | 4.54 |

Main increment: 5.74 kB raw / 2.33 kB gzip. English feature copy and small
loader integration contribute; selected translations load lazily. Recharts
was already present. Vite's >500 kB warning remains for main and the deferred
map. Loading a full WebGL map is expensive on low-end phones; automatic nearby
analysis does not require it. Do not interpret chunking as proven field-device
performance. Shared Recharts dependencies may already be fetched by dashboard.

Low-bandwidth safeguards: 256² automatic PNG, ≤512² normal phone image, bounded
series/catalog, cached server responses, local last-summary label, no automatic
basemap, no base64/scenes/GeoTIFF downloads. Images are not retained offline.
The browser times out EO requests at 90 s; upstream calls use shorter transport
timeouts, capped retries and two processing slots. Serverless duration limits
and replica-wide quotas still need production operational configuration.

Next device check: low-cost Android Chrome with permission denied/approximate/
precise settings, 3G loss, WebGL disabled, large text, Hindi/Urdu/Bengali native
review, indoor GPS and outdoor measured field boundaries. This remains a pilot
validation task, not an assertion that emulation tested device hardware.
