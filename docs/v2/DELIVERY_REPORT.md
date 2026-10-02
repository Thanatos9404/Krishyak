# Krishyak v2 delivery report

Prepared 3 October 2026 against the supplied 172-section brief. User sequence:
audit/plan first, then implement/test/push; no spending and blank missing keys.
This release provides the field-intelligence engineering workflow. It is not
an assertion of completed external production provisioning or field validation.

## A. Executive summary

Private plot records replace browser-only identity as the core workflow. Farmers
can maintain farms, mapped/manual fields and crop cycles, inspect Today evidence,
record observations/outcomes, upload private photos, give feedback, manage consent
and export/delete their data. Missing data remains unavailable. Existing planning
tools remain accessible. No paid service was activated.

## B. Architecture

Modular FastAPI plus durable worker; PostgreSQL/PostGIS; Redis atomic quotas;
private image provider interface; React/Vite with optional owner IndexedDB
cache/outbox. See [architecture](ARCHITECTURE.md). No generative agronomy layer or
unnecessary microservice split was introduced.

## C. Files changed

`backend/db`, `repositories`, `v2`, four Alembic revisions, requirements, Docker,
main/logging/weather boundaries and real integration/runtime tests implement the
backend. `frontend/src/features/farms`, root routing, manifest/icons/worker,
same-origin forwarding/headers and browser suites implement the farmer product.
Scripts supply local configuration, migration/test startup, role assignment,
operator aggregate inspection, load, outage/recovery, restore and documentation
checks. CI and the v2 documentation set provide release gates/runbooks. README,
technical guide and dataset status now describe the active 38-class release.

## D. Database

17 domain/security/operations tables, UUID owner scopes, geography-derived area
and centroid, active-consent uniqueness, cycle-overlap constraints,
revision/idempotency indexes, durable job/cleanup queues. Real migrations and
empty-database dump/restore passed. Legacy CSVs are not falsely imported as
verified accounts. See [database](DATABASE.md).

## E. Authentication/security

Configured mobile OTP, bounded challenges, hashed rotating revocable cookies,
exact Origin/CSRF, ownership joins, fresh privileged authentication, bounded
files/bodies, private objects, safe logs and deployment headers. Development
identities are fixed, visibly synthetic and prohibited in staging/production.
Deployed unsafe legacy personal-data routes are disabled. See
[security](SECURITY.md) and [threat model](THREAT_MODEL.md).

## F. Remote sensing

Stored boundaries drive quality-aware Sentinel-2 NDVI/NDMI/NDRE processing;
cloud/missingness, usable-pixel fraction, intervals and boundary revisions persist.
Worker checks permission/revision before and after provider work. Robust history
comparison yields inspection context; optional scheduling is disabled and capped.
Live access/scientific validation remains unverified without CDSE credentials.
See [remote sensing](REMOTE_SENSING.md).

## G. ML

Active EfficientNetV2B0/38-class release retained: 94.39% validation, 93.71%
internal test, 57.21% external PlantDoc. No retraining/promotion or new accuracy
claim. Private feedback/expert corrections are consented and audited; operational
agreement is not field accuracy. See [governance](MODEL_GOVERNANCE.md).

## H. UX

Today, My Farm, Crop Health, Market, Benefits and Privacy are organized around a
selected field. Manual fields work without GPS/provider access. Sources, units,
saved times, missingness and score limits are visible. Heavy map/chart/planning
modules load on demand. V2 core English/Hindi copy is draft; other languages show
explicit English fallback. The 23 legacy language packs remain. Local English
device readout makes no paid API request.

## I. Offline

Public production shell cache plus explicit private device snapshots, owner
isolation, seven-day snapshot TTL, 100-record outbox, immutable operation IDs,
actual-connection sync, conflict review and logout clearing/late-write guards.
Photo bytes/tokens stay out of IDB. Offline logout revokes the remote session
after reconnection. See [offline design](OFFLINE_ARCHITECTURE.md).

## J. Government

Official-source public PM-KISAN/PMFBY/Soil Health Card information is separate
from authorized interfaces. Unsupported tenant/benefit claims were corrected;
personal eligibility is not established. No Aadhaar/bank/land/Farmer Registry API
or application is fabricated. See [government boundary](GOVERNMENT_INTEGRATION.md).

## K. Testing

Complete Windows/Linux backend suites, existing/new frontend suites, three-engine
production E2E, mobile widths, automated Axe checks, actual schema/restore,
non-root compact inference and full local Docker services. Exact counts and
explicit skips are in [test report](TEST_REPORT.md).

## L. Security scans

Ruff/ESLint/format checks pass. Bandit found no v2/domain/repository findings;
npm and exact installed Linux dependency audits found no known vulnerabilities
at scan time. Independent penetration testing is not claimed. Private env,
photos, logs/backups and test artifacts are excluded from Git/builds.

## M. Performance

Bounded local read workload: 100 authenticated Today requests, concurrency eight,
zero errors and p95 105.67 ms. Throttled fresh 360 px mobile entry: 4.024 seconds;
map/planning assets are deferred. These are local/emulated measurements, not
public capacity/SLA or physical-device claims. Redis/PostGIS outage readiness
fails safely and recovers; the durable worker resumes.

## N. Deployment

Buildable non-root Docker API/worker, PostGIS/Redis volumes, worker heartbeat,
health/readiness, schema gates, security headers, same-origin proxy and pinned CI
are supplied. Existing public main-branch hosting is unchanged. Production
infrastructure and real credentials were not provisioned or purchased. Follow
[deployment](DEPLOYMENT.md) and [recovery](DISASTER_RECOVERY.md).

## O. Environment variables

`backend/.env.example` documents disabled defaults and blank credential slots.
Missing v2/provider fields were appended to the ignored local `.env` while
preserving existing values. Development uses a separate ignored synthetic file.
Production requires approved TLS PostgreSQL/Redis, private storage, real OTP,
HTTPS origins, secrets and worker. Optional CDSE/market/speech remain gated.

## P. Known limitations

[The limitations register](KNOWN_LIMITATIONS.md) lists missing live providers,
commercial/legal approvals, physical devices, reviewed translations, real pilot
and scientific validation, production off-site backups/incident contacts and
high-volume soak testing. No unsupported production-ready label conceals these.

## Q. Funding/pilot readiness

Consented selected-field cohorts, safe aggregate reports, farmer outcome records,
research review and source/provenance timelines provide pilot infrastructure.
No farmer traction, income improvement or government partnership is invented.
See [pilot protocol](PILOT_PLAN.md), [due diligence](DUE_DILIGENCE.md) and
[cost model](COST_MODEL.md).

## R. Release actions

Engineering changes are delivered through the requested feature branch with
buildable commits and CI. Live farmer activation requires the owner to supply
missing credentials and approve provider/hosting terms, then an authorized
staging smoke and accountable legal/agronomic/pilot review. These depend on
external authority/resources and cannot be replaced with code or fabricated data.

## Brief traceability

| Sections | Delivered evidence / boundary |
|---|---|
| 0–3 | Saved audit/plan, evidence taxonomy, current model status |
| 4–11 | Domain/PostGIS/migrations/auth/ownership/consent/rights/private objects |
| 12–20 | Persistent indices/quality/history/map/worker; draft weather fusion and sourced soil |
| 21–28 | Private classifier/feedback/review; prior truthful treatments/market/planning retained |
| 29–37 | Public-information government adapter and farmer information architecture |
| 38–43 | PWA/cache/outbox/conflicts/mobile/Axe; translation/physical-device review explicitly gated |
| 44–54 | Auth/headers/Redis/logging/health/jobs/versioned validation/provenance/freshness |
| 55–63 | Due diligence, scoped consented pilots, outcomes, model governance; no fabricated impact |
| 64–80 | Existing/new tests, E2E/matrix/build/load/outages/scans/CI/Docker/restore/secrets/privacy/retention |
| 81–84 | Consent-based record aggregates and cost/quota assumptions; free farmer access/no spending |
| 85–104 | Runbooks/docs, modular code/forms, bounded caches/idempotency/UTC/units/deployment compatibility |
| 105–113 | Clearly synthetic local staging and pilot/model validation protocols; external studies unperformed |
| 114–133 | Timeline/Today/notices/failure/quality/admin/audit/indexes/pagination/retries/scheduling/manual fallback |
| 134–145 | Draft privacy/terms, advice limits, current features, safe sensor boundary, code/static/format gates |
| 146–158 | Guarded migration/branch/Docker/onboarding/synthetic tests/quality gates/provider smoke/report/limitations |
| 159–171 | Phased implementation/self-review/delivery with engineering and field validation kept distinct |
