# Krishyak technical guide

Updated 9 October 2026. Use the [v2 architecture](docs/v2/ARCHITECTURE.md),
[API](docs/v2/API.md) and [delivery report](docs/v2/DELIVERY_REPORT.md) for the
implemented release. Historical evaluations remain historical; old model paths
and hackathon descriptions are not authoritative for current deployment.

## Application and evidence

Next.js 16 (App Router, React 19) hosts the public site and the private farmer
workspace (`/app/*`); `/app/more/planning` preserves the scenario tools. The
Next.js middleware (`src/proxy.js`) forwards same-origin API calls with a signed
client address. FastAPI has versioned private routers under `backend/v2`,
SQLAlchemy/PostGIS models under `backend/db`, ownership repositories, migrations
and a separate durable worker. There is no added generative agronomy service or
unnecessary microservice split.

The main flow is authenticated owner → farm → field → crop cycle → provenance
timeline → explainable inspection action → farmer feedback/outcome. Missing
weather/satellite/model/market evidence stays unavailable. Exact boundaries are
optional; manual fields remain usable without satellite access.

| Output | Actual method | Limitation |
|---|---|---|
| Crop photograph | Active EfficientNetV2B0 classifier / compact LiteRT runtime | External generalization and calibrated probability not established |
| Today | Conservative deterministic composition | Draft rules, not a trained farm-health model |
| Satellite | Sentinel-2 masked band ratios and robust interval comparison | Cannot establish disease, NPK, yield or water-stress cause |
| Weather | Open-Meteo model conditions / 48-hour forecast for the field's rounded location | Not a field sensor measurement |
| Mandi prices | AGMARKNET current and variety-wise history (data.gov.in), stored per market series | Trend only within one market/variety/grade; reported wholesale prices, not offers |
| Soil | Unit-bounded farmer lab/card/sensor/manual entry | Independent measurement verification absent |
| Planning economics/yield/risk | Reference baselines, formulas and assumptions | Not guaranteed or independently regionally calibrated |
| Price forecast/Monte Carlo | Persistence baseline and uncertainty scenarios | No validated optimal sale date |
| Benefits | Public official-source information / verification boundaries | No registry access or individual eligibility decision |

## Current ML release

`backend/models/active/release.json` identifies
`publisher-efficientnet-colab-v1`, EfficientNetV2B0 with 38 classes across 14 crop
categories. Validation 94.3870% (n=5,416), internal test 93.7077% (n=8,566),
external PlantDoc 57.2052% (n=229; Wilson 95% 50.7299–63.4428%). The former
42-class MobileNet/checkpoint descriptions apply only to archived experiments.
No candidate was retrained or promoted in v2. Hashes, authoring artifacts,
runtime verification and dated evaluation reports remain in the repository.
See [model governance](docs/v2/MODEL_GOVERNANCE.md) before making accuracy claims.

## Persistence and security

Postgres/PostGIS stores 23 v2 tables with geodesic area/centroid, ownership,
partial active-consent uniqueness, revision/idempotency indexes and cycle-overlap
constraints. Ten Alembic revisions (v2_0001–v2_0010) define the schema; extension metadata is
excluded from destructive drift generation. Owner-domain rows cascade on deletion;
object cleanup survives independently.

Farmers sign in with a passkey (phone fingerprint or screen lock, WebAuthn) and a
single-use recovery code; SMS OTP is an optional adapter. Opaque access/refresh
credentials are hashed server-side; mutations require exact Origin plus CSRF.
Research/expert/institutional access needs current purpose consent, roles and
recent authentication. Private JPEG objects strip metadata, are stored in a
private object store (Vercel Blob, S3-compatible or local) and are never served
publicly. The former unauthenticated registration, sensor, pest-report and
identity-verification routes were removed.

Redis quotas fail closed in deployment and budget every provider credential
(Copernicus, Sarvam, data.gov.in, Open-Meteo) per caller, per day and, for
metered services, per month across all serverless instances. Worker claims use leases, bounded retries,
deduplication and boundary/permission rechecks. Cleanup and worker heartbeat are
durable. Logs use safe request IDs and mask private resource identifiers.
Production requires TLS database/Redis, private object storage and a real sign-in
method (passkeys or a configured SMS provider).

## Offline and operations

Only the public shell/assets enter service-worker caches. Explicit owner-scoped
IndexedDB opt-in stores seven-day snapshots and a bounded note outbox, with
operation UUID replay, conflict review and logout/account isolation. Images and
tokens are not stored offline. Server revocation after an offline logout requires
reconnection; the UI explains it.

Local Docker/production-preview and disposable databases are verified separately
from public hosting. Read the [test report](docs/v2/TEST_REPORT.md) for exact
coverage and exclusions, [deployment](docs/v2/DEPLOYMENT.md) for configuration,
and [limitations](docs/v2/KNOWN_LIMITATIONS.md) for unverified external gates.
Software pass counts cannot substitute for farmer, legal, scientific or
government validation.
