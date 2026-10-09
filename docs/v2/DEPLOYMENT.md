# Deployment and development onboarding

No paid resource was created for this implementation. Current public hosting
continues to serve its existing main-branch deployment until a release is chosen.
The feature branch is not equivalent to a verified live v2 deployment.

## Local development

Use Python 3.12, Node 24 (22.13+ also supported), and Docker Desktop. Install
`backend/requirements-dev.txt` in a venv and `npm ci` in `frontend`. Copy
`backend/.env.example` to an ignored local file. Never commit credentials.

For local Docker, create `.codex-tmp/v2-local.env` containing a generated
`V2_LOCAL_DB_PASSWORD`, `V2_AUTH_SECRET` (32+ random characters),
`KRISHYAK_V2_ENABLED=true`, `ENVIRONMENT=development`,
`V2_DATABASE_URL=postgresql+psycopg://krishyak:<local-password>@127.0.0.1:55432/krishyak_v2`,
`V2_REDIS_URL=redis://127.0.0.1:56379/0`,
`V2_OTP_PROVIDER=development`, and `V2_DEV_MOBILES=+919000000001,+919000000002,+919000000003`.
Set exact CORS origins for localhost ports 3000 and 3001 (3001 is WebKit's
test-only outage proxy). Development OTP is always labelled synthetic and is
`123456` for these allowlisted identities only. No SMS is sent.

```sh
docker compose -p krishyak-v2 --env-file .codex-tmp/v2-local.env -f docker-compose.v2.yml up -d
python scripts/run_v2_local.py migrate
python scripts/run_v2_local.py api
# A second terminal:
python scripts/run_v2_local.py worker
# Frontend terminal:
cd frontend
npm ci
npm start
```

Use the backend venv's Python on Windows. `run_v2_local.py --env <ignored-file>`
accepts a separate test configuration. Default API port is 8000; frontend is
3000. Production PWA checks require `npm run build` then `npm run preview`.

The complete local container stack is optional:

```sh
docker compose -p krishyak-v2 --env-file .codex-tmp/v2-local.env -f docker-compose.v2.yml --profile app up -d --build
docker compose -p krishyak-v2 --env-file .codex-tmp/v2-local.env -f docker-compose.v2.yml exec -T api python -m alembic upgrade head
```

API is loopback port 18000; named volumes persist PostGIS, Redis and private
development photos. API/worker run as UID 10001. Public MSP/location JSON assets
are explicitly included; farmer CSVs, photos, caches, env, logs and authoring
weights are excluded from the image. Restart policies and worker retry loops
support transient storage recovery. Do not run `down --volumes` on retained data.

## Production contract

Hosting is two Vercel projects: `krishyak` (Next.js, frontend) and `krishyak-api`
(FastAPI, region `sin1` next to the database). The frontend middleware
(`frontend/src/proxy.js`) forwards `/api/v2/*` and `/api/public/*` same-origin to
`KRISHYAK_API_ORIGIN`, so session cookies stay first-party. It adds a 2-minute
HMAC-signed `x-krishyak-client` header with the farmer's address (trusted by
the API only with the shared `KRISHYAK_PROXY_SECRET`) and, for protected
previews, the `x-vercel-protection-bypass` header from server configuration.

| Settings (API) | Requirement |
|---|---|
| `ENVIRONMENT`, `KRISHYAK_V2_ENABLED` | `production` (or `staging`), explicit `true` after provisioning |
| `SECRET_KEY`, `V2_AUTH_SECRET`, `CRON_SECRET`, `KRISHYAK_PROXY_SECRET` | Separate generated secrets (32+ characters) |
| `V2_DATABASE_URL` (or Neon's `DATABASE_URL`) | TLS Postgres with PostGIS/btree_gist and the migrated schema; the pooled URL for the API; migrations use `V2_MIGRATION_DATABASE_URL` or `DATABASE_URL_UNPOOLED` (direct) under an advisory lock |
| `CORS_ORIGINS` | Exact HTTPS frontend origins; each is also a passkey relying party |
| `V2_REDIS_URL` (or Upstash's `KV_URL` / `REDIS_URL`) | Authenticated TLS `rediss://` Redis (shared quotas, OAuth state, pacing) |
| `V2_HTTP_MIGRATIONS` | `true` only while applying migrations through `POST /api/v2/internal/migrate` (Bearer `CRON_SECRET`) when credentials are deployment-only sensitive variables; then `false` |
| Sign-in | `V2_PASSKEY_ENABLED=true` (no SMS needed); optionally `V2_OTP_PROVIDER=twilio` + `TWILIO_*` |
| Photos | `V2_STORAGE_PROVIDER=vercel_blob` with a **private** Blob store connected to the project (`BLOB_READ_WRITE_TOKEN`), or `s3` with a private bucket |
| Worker | `V2_WORKER_MODE=request` on Vercel (default there): jobs drain after enqueue and daily via the cron in `backend/vercel.json`; `dedicated` runs `python -m v2.worker` |
| Retention | `V2_IMAGE_RETENTION_DAYS`, `V2_AUDIT_RETENTION_DAYS` approved by the operator |
| Providers | `DATA_GOV_IN_API_KEY`, `SARVAM_API_KEY`, `REMOTE_SENSING_ENABLED` + `CDSE_CLIENT_ID/SECRET`; budgets: `REMOTE_SENSING_GLOBAL_PER_DAY/MONTH`, `SARVAM_*_DAILY`, `OPEN_METEO_PUBLIC_PER_DAY` |

| Settings (frontend) | Requirement |
|---|---|
| `KRISHYAK_API_ORIGIN` | API origin (staging: `https://krishyak-api-staging.vercel.app`) |
| `KRISHYAK_PROXY_SECRET` | Same value as the API |
| `KRISHYAK_API_PROTECTION_BYPASS` | Previews only: the API project's automation bypass secret |

Startup refuses a deployed v2 configuration without TLS database/Redis, private
storage, a real sign-in method and a worker trigger secret. Readiness
(`/health/ready`) checks the schema head, PostGIS, Redis and either the worker
heartbeat (dedicated) or that no queued job is stranded for 30 minutes (request
mode). Liveness alone is not readiness.

## Release order

1. Provision Postgres (Neon free tier, region Singapore) and Redis (Upstash) from
   the Vercel Marketplace and connect them to `krishyak-api`; enable the
   `postgis` and `btree_gist` extensions through the migration.
2. Set the variables above for the target environment (`vercel env add … --sensitive`).
3. Run `alembic upgrade head` against the direct (non-pooled) URL. When the
   URL exists only as a sensitive deployment variable, deploy with
   `V2_HTTP_MIGRATIONS=true`, call `POST /api/v2/internal/migrate` with
   `Authorization: Bearer $CRON_SECRET`, confirm `schema == head`, then set it
   back to `false`.
4. Deploy the API (`python scripts/prepare_vercel_source.py backend`, then
   `vercel deploy` from the staged folder) and the frontend.
5. Staging: `vercel alias set <deployment> krishyak-api-staging.vercel.app` and
   `krishyak-staging.vercel.app`. Passkeys are bound to that stable hostname.
6. Check `/health/ready`, then run the live smoke (`scripts/smoke_staging.py`).
7. Promote to production only after the combined build and smoke pass.

Rollback code and routing to the prior known-good release. Prefer forward schema
repair; inspect retained data before any downgrade. Restore database/objects
together using [disaster recovery](DISASTER_RECOVERY.md). Never expose a database
port or enable development identities in a deployment (startup rejects them).
