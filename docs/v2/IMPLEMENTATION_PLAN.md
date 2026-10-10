# Krishyak v2 implementation plan

Prepared 3 October 2026 from the attached 172-section brief, repository audit and
live browser inspection. User direction: first plan, then implement. This plan
does not pause routine engineering for another approval.

## Product decision

Make the persisted farmer → farm → plot → crop cycle → evidence timeline the
primary workflow. Today answers “What should I pay attention to today?” using
up to five explainable inspection actions. Keep planning, markets, benefits,
photos, weather, translations and speech. Preserve explicit missing evidence.
Do not retrain the model or introduce a generative agronomy dependency.

## Architecture decisions

- Modular FastAPI monolith plus a durable worker; versioned `/api/v2` routes.
- PostgreSQL/PostGIS, SQLAlchemy 2 sessions, Alembic migrations, UUID ownership.
  Existing `backend/models/active` remains model artifacts; ORM domain belongs
  under `backend/db` to avoid confusing imports and model weights.
- Opaque revocable server-side sessions with HttpOnly cookies, rotation, bounded
  OTP attempts and Origin/CSRF checks. Provider abstraction; fixed test identities
  only in explicitly configured development/test. No production mock identity.
- Purpose/versioned consent, export/deletion and independent research opt-in.
- Local image storage for development; private S3-compatible production objects,
  decoded bounded images, stripped EXIF and authorized downloads.
- Reuse Copernicus implementation; owner-scoped persistent derived observations,
  explicit quality/freshness and conservative history; no disease inference from indices.
- IndexedDB owner-scoped cache/outbox, idempotency and revision conflicts; cache
  public application shell only, clear private data on logout/account deletion.
- Distributed Redis quotas in deployed environments, bounded jobs and readiness
  probes. Optional integrations must fail visibly without making core manual use fail.

Sources checked: [SQLAlchemy sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html),
[Alembic migrations](https://alembic.sqlalchemy.org/en/latest/tutorial.html),
[PostGIS geography area](https://postgis.net/docs/ST_Area.html),
[Copernicus statistics](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Statistical.html).

## Delivery sequence and acceptance

| Phase | Deliverable | Required verification |
|---|---|---|
| 0 Audit/stabilize | Saved audit/plan, corrected current docs, CI/config/security inventory | Baseline suites; claims match active release; dependencies scanned |
| 1 Foundation | PostGIS migrations, OTP/session auth, ownership, consent, farm/plot/cycle CRUD, images and data rights | Clean/upgrade migration; OTP expiry/replay/rotation; two-owner IDOR; invalid geometry/files; deletion/export |
| 2 Persistent evidence | Worker, Copernicus adapter reuse, quality-controlled timeline, cache/deduplication | All-cloud/malformed/no scenes/outage; provider fixture calculations; authorized real smoke only if credentials exist |
| 3 Farmer workspace | Today/My Farm/Plot Health, map/manual fallback, Crop Health/Market/Benefits/Planning | Browser onboarding, uncertainty, source panels, keyboard/mobile, reviewed pilot-language text |
| 4 Feedback/pilot | Model feedback, restricted agronomist review, action/outcome cohort tracking, aggregate reports | Role isolation, research consent withdrawal, active-label corrections, no invented pilot metrics |
| 5 Offline/reliability | Installable shell, owner cache/outbox, revisions/idempotency, distributed limits, monitoring | Disconnect/reconnect, expired session, double submit, account switch, Redis/DB/storage failures |
| 6 Validation/release | CI, load/security/E2E/accessibility, staging, runbooks, final reports, commit/push | All mandatory checks pass with exact counts; explicit unresolved external gates |

Each phase is reviewed before proceeding. No main-branch rewrite, production
farmer-data tests or automatic public promotion of an unverified candidate.
Branch: `feat/krishyak-v2-field-intelligence`, preserving the newer feature-branch
deployment fixes. Logical commits should stay buildable.

## Contract details

All private API queries derive owner from the authenticated session, never a
supplied farmer ID. Paginate collection endpoints. Validate finite values,
dates, enum crops, coordinates and payload size. Geometry area is calculated
server-side; manual area remains manual evidence. Reject unsupported GIS extremes.
Bound crop-cycle overlaps transactionally. Write retries use owner-scoped client
operation IDs and reject the same key with a different payload. Updates require
the prior revision. Evidence exposes source type, observation/retrieval dates,
method, quality, processing/model version and limitations. Missing evidence
produces insufficient/unavailable states; raw model scores are labelled model scores.

## External gates and honest release reporting

Paid/authorized OTP, storage, CDSE and market credentials may be unavailable.
Implement interfaces and safe unavailable paths; test fixtures stay test-only.
PostGIS and staging services must be exercised before claiming verified production
deployment. Farmer pilots, physical-device QA, agronomic/legal review, government
authorization and independent field evaluation cannot be fabricated in code.

Final report records implemented versus planned versus NOT VERIFIED LIVE,
exact passing/skipped/failed checks, migration/restore evidence, browser matrix,
provider limitations, current model metrics, and outstanding release gates.
Completion of the full brief requires all applicable engineering checks plus
committed/pushed code; a saved roadmap alone is not implementation completion.
