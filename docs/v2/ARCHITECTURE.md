# Architecture

The v2 workspace persists field evidence in a modular FastAPI monolith. A separate
worker processes durable jobs and retention. This is decision support, not
autonomous farm control. Public scenario planning remains under `/planning`.

```mermaid
flowchart LR
  UI[Next.js 16 farmer workspace PWA] -->|same origin| PX[src/proxy.js, HMAC-signed client header]
  UI --> IDB[Optional owner-scoped IndexedDB]
  PX --> API[FastAPI v2 on Vercel sin1]
  API --> PK[WebAuthn passkeys and recovery codes]
  API --> PG[Neon PostgreSQL + PostGIS]
  API --> Redis[Upstash Redis usage budgets]
  API --> Objects[Private Vercel Blob photos, Mumbai]
  API --> ML[LiteRT EfficientNetV2B0 with abstention]
  API --> Weather[Open-Meteo 48-hour forecast]
  API --> Market[AGMARKNET via data.gov.in]
  API --> Speech[Sarvam speech and read-aloud]
  Cron[Vercel Cron, daily] --> Worker[Durable evidence worker]
  API -->|drain in request| Worker
  PG --> Worker
  Worker --> CDSE[Copernicus Sentinel-2 L2A]
  Worker --> Objects
```

The full design, with sequence diagrams for the photo check and satellite jobs,
the model pipeline and the data model, is in the
[technical design document](../TECHNICAL_DESIGN.md).

`backend/db` defines persistence; `repositories/ownership.py` scopes resources;
`v2/auth.py` owns session security; routers own validation and transactions.
`v2/providers.py` contains OTP/object-storage interfaces. Existing
`remote_sensing/providers/base.py` defines the satellite provider boundary.
Government adapters explicitly distinguish public information from authorized access.

Today composes stored provenance and conservative rules. It does not call a
generative model, infer disease from vegetation indices, adjust economic returns
with satellite data, or assign a universal health score. Image inference uses the
active release metadata, not a newly promoted checkpoint.

Deployed accounts require TLS database/Redis, private S3-compatible storage,
configured OTP and a running worker. A static frontend or sleeping free API alone
cannot supply those guarantees. See [deployment](DEPLOYMENT.md) and
[limitations](KNOWN_LIMITATIONS.md).
