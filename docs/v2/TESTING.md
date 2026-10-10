# Validation commands and scope

Tests use labelled synthetic identities, fields and provider fixtures. They
never send SMS, call Sarvam, submit government forms or incur provider charges.
Real CDSE smoke is skipped without credentials; no fixture response is a live
provider result. The final recorded outcomes are in [test report](TEST_REPORT.md).

```sh
python scripts/run_v2_local.py test --all
python -m ruff check backend/v2 backend/db backend/repositories backend/migrations backend/test_v2_foundation.py
python -m ruff format --check backend/v2 backend/db backend/repositories backend/migrations backend/test_v2_foundation.py
python -m bandit -r backend/v2 backend/db backend/repositories
python -m pip_audit -r backend/requirements.txt
python scripts/verify_v2_database.py
python scripts/load_v2_local.py
python scripts/verify_v2_resilience.py
cd frontend
npm ci
npm test -- --runInBand
npm run format:check:v2
npm run build
npm audit --audit-level=low
npx playwright install chromium firefox webkit
# Point API/production preview at a separate disposable E2E database:
# V2_E2E_PRODUCTION=true
npm run test:e2e
```

Windows users should use the venv executable. For options PowerShell strips
through npm, call `node node_modules/@playwright/test/cli.js test` directly.
CI runs Linux/Python 3.12, PostGIS17 and Redis7, a production frontend build,
three browser engines and an independent non-root Linux container inference
smoke without network. Action commits and dependencies are pinned/locked.

Backend covers OTP expiry/attempts/replay, CSRF/session rotation, owner IDOR,
geometry area/validity, overlaps/revisions, operation replay, consent races,
private files, research/expert role scope, weather malformed/missing evidence,
soil units, worker retries/stale results, scheduling, account cascades and pilots.
Existing simulation, market, remote-sensing, speech and model regressions remain.

Frontend includes legacy behavior and IndexedDB owner isolation/conflict/logout.
E2E covers onboarding/consent/manual plot/cycle, observation/export, field edits,
soil provenance, unsupported photo/feedback/download/delete, public benefits,
offline reload/recovery/logout, viewport overflow and automated Axe WCAG checks.
Throttled mobile performance uses Chromium CDP only; other browser performance
copies are explicitly skipped. Viewports are 320–1280 px, not physical devices.

Load check is bounded to 100 synthetic authenticated reads at concurrency eight
against loopback Docker and cleans its farm. It refuses public hosts/real OTP
providers. This cannot establish production capacity, image throughput or SLA.
Independent accessibility review, real Android/iOS, high-volume soak and
authorized production provider/security tests remain unverified.
