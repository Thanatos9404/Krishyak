# Krishyak v2 current-state audit

Audit date: 3 October 2026 (India). Starting revision: `b8eb0c7` on
`feature/krishyak-geoai-remote-sensing` (verify full revision in Git history).
Remote references were refreshed before planning. `origin/main` is `03452a1`;
the starting branch contains main plus four newer deployment/documentation commits.
The v2 branch preserves those improvements. No existing working-tree changes were present.

## Architecture and persistence

React 18/Vite/Tailwind frontend, FastAPI modular planning services and a large
`main.py` router. Separate Vercel frontend/API projects; a legacy Render manifest
targets Python 3.11 despite the documented production Python 3.12 runtime.
The active deployment uses a compact float32 LiteRT classifier. Registration
uses locked/atomic plaintext CSV, with ephemeral `/tmp` on Vercel. Soil/pest
records are local files, speech quota accounting uses SQLite, most caches and
general rate limits are per process. No PostgreSQL, migrations, authenticated
plot ownership, distributed job queue or CI gate exists in the starting tree.

## Identity, privacy and security

`useFarmerSession` restores a browser profile from sessionStorage; this is not
server authentication. Aadhaar is scrubbed and registration requires consent,
but consent is not a durable service-purpose ledger. Logout clears local caches
without deleting server registrations. Sensor endpoints accept device IDs with
no owner checks. Pest report APIs need private/aggregate separation. Government
token/consent mechanisms are demonstration abstractions, not production identity.
These are blockers to collecting real farmer identities and exact plot boundaries.

Existing safeguards include bounded finite numeric inputs, decoded image/MIME
checks, EXIF handling, white alpha compositing, request IDs, redacted errors,
restricted CORS, optional proxy trust, process rate limiting and speech quotas.
No complete account export/deletion flow, CSRF/session rotation, tenant access
policy, spatial privacy control, backup/restore test or independent security
review is established. Logging still uses naive UTC in places.

## ML and datasets

Single source of current truth: `backend/models/active/release.json`.
`publisher-efficientnet-colab-v1`, EfficientNetV2B0, 38 classes: validation
94.3870% / 5,416; internal test 93.7077% / 8,566; external PlantDoc
57.2052% / 229 (recorded interval 50.73–63.44%). Metrics were read, not rerun.
Runtime parity evidence is separate from accuracy evidence. Crop mismatch,
low-score abstention, unavailable model and healthy classifier states exist.
Softmax is not calibrated diagnostic probability; OOD rejection is unproven;
classification does not establish severity or field health.

`TECHNICAL_PROJECT_GUIDE.md` still describes MobileNetV2/42 classes, global RNG
and fabricated fallback paths already replaced. `datasetused.md` incorrectly
says the 42-class deployment remains active. `backend/evaluation` is historical
legacy-model evidence and must remain labelled historical. Dataset publisher
revisions/hashes exist; legacy asset licensing and Indian field validation are
incomplete. Treatment/dose knowledge needs qualified source/applicability review.

## Integrations and fallback behavior

| Source | Implemented boundary | Live verification limit |
|---|---|---|
| Open-Meteo | weather forecasts; gridded climate context | Provider/network availability varies; not lab/sensor measurements |
| Copernicus Data Space | OAuth, server-side Sentinel-2 statistics/previews | Credentials absent in prior release verification; NOT VERIFIED LIVE |
| data.gov.in | validated mandi adapter, dated source status | Requires configured key; no invented replacement prices |
| MSP | source-linked publication snapshot | Published rate is not a guaranteed transaction/entitlement |
| Sarvam | bounded STT/TTS, static generated translations | Prior speech smoke evidence exists; translations need human review |
| Sensor adapters | manual entry and vendor boundaries | No verified connected hardware |
| Aadhaar/AgriStack/land/bank/DBT | demo/adapter patterns | Not authorized production integrations; demo disabled by default |
| Scheme catalog | rule matching, documents and links | Not official eligibility, enrollment, approval or disbursement |

Planning uses rules, assumed costs, persistence prices and Monte Carlo scenarios.
Missing observations remain unknown; these safeguards must be retained. Some
copy still implies AI optimization, observed soil, best selling dates or verified
benefits. Static assumptions require source/version/freshness, not invented confidence.

## Remote sensing

Existing `remote_sensing` module already has provider abstraction, geometry
canonicalization, geodesic area, 200-vertex/500-ha bounds, no self intersections,
Sentinel SCL/dataMask quality handling, NDVI/NDMI/NDRE, conservative history
trend, bounded cache/concurrency and transparent preview provenance. Current
geometry supports a single exterior ring; holes/multipart/antimeridian are
explicitly unsupported. Device-centred 200 m context is not a confirmed plot.
Results are not persisted as owner-scoped crop-cycle timelines. Cached/statistical
evidence cannot be interpreted as pathogen diagnosis or irrigation prescription.

## UX, offline and performance

Live browser inspected Dashboard and Field Intelligence. Navigation and boundary
controls render. Location was not supplied, and no production personal data was
submitted. Field Intelligence attempts GPS automatically; unavailable observation
states and boundary/manual controls exist. No authenticated Today/My Farm workflow.
Manifest plus localStorage summaries do not constitute an offline PWA: no service
worker, IndexedDB outbox, conflict detection or multi-device synchronization.
23 language packs exist; machine translation is not field approval. Expensive
features are lazy-loaded, but main/map bundles remain large. Keyboard, physical
phone, slow network and comprehensive accessibility validation remain incomplete.

## Tests and operations

Baseline backend/frontend suites were started during this audit; exact fresh
results are recorded in the verification report when complete. Prior recorded
checks: 199 backend tests (198 pass, one live satellite skip), 283 frontend tests,
lint/build pass. Those historical results are not evidence for v2 changes.
No PostGIS migration, backup restore, account isolation, offline synchronization,
multi-browser E2E, staging promotion, load SLO or CI run is established for v2.
Existing production readiness report is candid and should remain historical.

## Unsupported claims to exclude

- Production-ready private farmer accounts or durable registration on serverless CSV.
- Active MobileNetV2/42-class model or 95%+ independent Indian field accuracy.
- Satellite diagnosis, measured satellite soil nutrients or a validated 0–100 health score.
- Live sensors, real AgriStack/Aadhaar/bank/DBT access or government endorsement.
- Verified scheme approval, guaranteed MSP sale or an optimal forecast selling date.
- Calibrated yield/risk/profit probabilities, measured income gains or farmer traction.
- Complete offline operation, scale reliability, legal compliance or field-safe translations.

Feature implementation starts only after this audit and the implementation plan
are saved. Production engineering and agronomic field validation remain separate gates.
