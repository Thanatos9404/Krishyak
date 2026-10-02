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

Use HTTPS same-origin API forwarding so Secure SameSite cookies work reliably.
`frontend/vercel.json` currently targets the existing Vercel API; replace that
destination with an approved persistent API before v2 activation there. The
frontend build alone needs no provider secret. The API and worker require:

| Settings | Requirement |
|---|---|
| `ENVIRONMENT`, `KRISHYAK_V2_ENABLED` | `production`, explicit `true` after provisioning |
| `SECRET_KEY`, `V2_AUTH_SECRET` | Separate generated server secrets |
| `V2_DATABASE_URL` | Postgres psycopg URL with TLS, PostGIS/btree_gist, migrated schema |
| `CORS_ORIGINS` | Exact HTTPS frontend origins; no wildcard |
| `V2_REDIS_URL` | Authenticated TLS `rediss://` Redis |
| `V2_OTP_PROVIDER`, `TWILIO_*` | Configured Verify service; no development identities |
| `V2_STORAGE_PROVIDER`, `V2_S3_BUCKET`, optional endpoint | Private S3-compatible bucket and least-privilege SDK credential chain |
| Retention | `V2_IMAGE_RETENTION_DAYS`, `V2_AUDIT_RETENTION_DAYS` approved by operator |
| Optional satellite | `REMOTE_SENSING_ENABLED`, `CDSE_CLIENT_ID/SECRET`; scheduling separately opt-in |
| Optional markets/speech | `DATA_GOV_IN_API_KEY`, `SARVAM_API_KEY`; do not activate paid usage without budget approval |

Missing deployment prerequisites fail startup or leave v2 explicitly disabled;
there is no production test login. Blank placeholders are retained for the owner.
The existing free Render service sleeps and has ephemeral application storage;
it is not a durable database, object bucket or always-on worker. No upgrade was
purchased. A production operator must approve hosting/provider terms and costs.

Release order: backup; validate secrets/permission policies; migrate; start one
worker; check `/health/live` and `/health/ready`; route same-origin traffic;
run an authorized synthetic staging account/rights/consent smoke; verify real
provider failures and configured provider tests; review monitoring; then admit
consented farmers. Deployed readiness checks schema, PostGIS, Redis and a worker
heartbeat within ten minutes. Liveness alone is not readiness.

Operators can run `python scripts/inspect_v2_operations.py --env <ignored-file>`
to read schema, database bytes, aggregate job/cleanup states, expired leases and
worker heartbeat without printing personal records or secrets. Investigate failed
cleanup before claiming completed byte erasure. Do not reset shared quota stores
or retry changed jobs to suppress failures.

Rollback code and routing to the prior known-good release. Prefer forward schema
repair; inspect retained data before any downgrade. Restore database/objects
together using [disaster recovery](DISASTER_RECOVERY.md). Never expose a database
port or turn on mock government/OTP flows to bypass release gates.
