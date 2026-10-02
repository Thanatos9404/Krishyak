# Krishyak — Field Intelligence

Private farm records, source-labelled field evidence and decision support for
Indian farmer pilots. The v2 workspace is the main application; scenario
planning remains available at `/planning`.

**Release status, 3 October 2026:** v2 engineering is implemented on
`feat/krishyak-v2-field-intelligence`. Local PostGIS, Docker, browser, security
and restore checks are documented in [the test report](docs/v2/TEST_REPORT.md).
Public hosting continues its existing deployment. Production v2 activation
requires configured infrastructure/credentials and accountable pilot review;
there is no production demo login or fabricated provider data.

## What is implemented

- Mobile OTP adapter, revocable rotating server sessions, ownership, purpose
  consent, profile/farm/plot/crop-cycle records and revision conflicts.
- Postgres/PostGIS geometry, computed hectares/centroid, manual-area fallback,
  typed provenance/timeline, farmer-entered outcomes, account export/deletion.
- Today inspection actions from stored satellite/weather/soil context; explicit
  unavailable/cloudy/stale/insufficient states. No universal health score.
- Sentinel-2 L2A NDVI/NDMI/NDRE adapter, durable permission-aware worker,
  quality-masked private preview, history/deduplication and opt-in capped scheduling.
- Private normalized photo storage, active classifier result/limitations,
  farmer feedback and research-consented expert corrections.
- Scoped pilot cohorts, selected-field opt-in, in-app notices and aggregate
  reports that keep unmeasured impact null.
- Installable public PWA shell; optional owner-scoped offline snapshots and
  bounded idempotent observation queue, explicit conflicts and logout cleanup.
- Farmer Today/My Farm/Crop Health/Market/Benefits/Privacy screens; on-demand
  map/chart/planning modules, device-only English readout and written fallback.
- Existing simulation, fertilizer, market, MSP, weather and 23 legacy language
  packs preserved. New v2 core has English/Hindi draft strings; other languages
  explicitly fall back to English pending reviewed translations.

Unsafe legacy personal-data endpoints are disabled in deployed environments.
Public government cards link official information and require verification;
they do not establish personal eligibility or authorized registry access.

## Evidence boundaries

The active disease model remains `publisher-efficientnet-colab-v1`,
**EfficientNetV2B0, 38 classes / 14 crops**. Validation accuracy is 94.39% on
5,416 images; internal test 93.71% on 8,566; external PlantDoc **57.21% on 229**
(Wilson 95% interval 50.73–63.44%). No model was retrained/promoted here.
Raw scores are not calibrated diagnostic probabilities. Runtime smoke tests
are not accuracy evaluations. See [active release](backend/models/active/release.json)
and [governance](docs/v2/MODEL_GOVERNANCE.md).

Today is deterministic evidence composition. Yield/economics/fertilizer/risk
remain assumptions and draft rules; price forecasting is a persistence baseline
with historical context; Monte Carlo scenarios are uncertainty estimates.
Satellite indices cannot diagnose disease, soil NPK, yield or irrigation dose.
Farmer-entered soil/outcomes are not independently verified. No measured income
improvement, government approval or field-validation claim is made.

Missing CDSE, production SMS/storage and mandi credentials remain blank/unavailable.
No paid service was activated. [Known limitations](docs/v2/KNOWN_LIMITATIONS.md)
list live-provider, legal, agronomic, physical-device and pilot release gates.

## Run locally

Use Python 3.12, Node 24 and Docker Desktop. Install backend development
requirements in a venv; run `npm ci` in `frontend`. Follow
[the exact local configuration and commands](docs/v2/DEPLOYMENT.md).

```sh
docker compose -p krishyak-v2 --env-file .codex-tmp/v2-local.env -f docker-compose.v2.yml up -d
python scripts/run_v2_local.py migrate
python scripts/run_v2_local.py api
# Separate terminals:
python scripts/run_v2_local.py worker
cd frontend
npm start
```

Synthetic test mobiles are allowlisted only in development/test, visibly
labelled, and use `123456` without sending SMS. Never use this configuration for
real farmers. Production settings reject development OTP/local image storage.

For the non-root container API/worker use the compose `app` profile. The local
API is port 18000; PostGIS/Redis bind loopback 55432/56379. Volumes persist data.
Never commit env, photos, farmer CSVs, tokens or backup contents.

## Verify and operate

[Testing](docs/v2/TESTING.md) documents unit/integration/browser/accessibility,
dependency, formatting, load and container checks. CI uses disposable PostGIS
and Redis, three browser engines and a Linux classifier smoke.
`scripts/verify_v2_database.py` performs a guarded disposable migration/restore
drill. `scripts/load_v2_local.py` refuses public origins and real SMS providers.
`scripts/grant_v2_role.py` requires an operator reason and revokes prior sessions.

`/health/live` checks process liveness. `/health/ready` checks enabled schema,
PostGIS, Redis and (in deployment) a recent worker heartbeat. A static site or
sleeping free API alone cannot provide persistent production v2 services.

## Documentation

- [Audit](docs/v2/CURRENT_STATE_AUDIT.md), [plan](docs/v2/IMPLEMENTATION_PLAN.md),
  [delivery report](docs/v2/DELIVERY_REPORT.md), [test report](docs/v2/TEST_REPORT.md).
- [Architecture](docs/v2/ARCHITECTURE.md), [domain](docs/v2/DOMAIN_MODEL.md),
  [API](docs/v2/API.md), [database](docs/v2/DATABASE.md),
  [satellite evidence](docs/v2/REMOTE_SENSING.md), [model governance](docs/v2/MODEL_GOVERNANCE.md).
- [Security](docs/v2/SECURITY.md), [threat model](docs/v2/THREAT_MODEL.md),
  [privacy](docs/v2/PRIVACY.md), [offline](docs/v2/OFFLINE_ARCHITECTURE.md),
  [deployment](docs/v2/DEPLOYMENT.md), [recovery](docs/v2/DISASTER_RECOVERY.md).
- [Government boundary](docs/v2/GOVERNMENT_INTEGRATION.md),
  [pilot protocol](docs/v2/PILOT_PLAN.md), [due diligence](docs/v2/DUE_DILIGENCE.md),
  [cost model](docs/v2/COST_MODEL.md), [datasets](datasetused.md).

[Public app](https://krishyak.vercel.app/) ·
[Repository](https://github.com/Thanatos9404/krishyak).
