# Release verification report

Date: 3 October 2026, India. Branch:
`feat/krishyak-v2-field-intelligence`. All account/device evidence below is
synthetic and local. Earlier failed runs were repaired and repeated; the counts
below refer to passing release checks, not baseline or guessed results.

| Gate | Recorded result | Scope |
|---|---|---|
| Windows backend | 229 run, 227 passed, 2 skipped | Complete suite plus real disposable PostGIS |
| Linux backend | 229 run, 228 passed, 1 skipped | Release image, real PostGIS, public parity catalogs mounted read-only |
| Foundation | 29 passed | OTP/session/ownership/consent/geometry/rights/jobs/context/pilots |
| Frontend | 287 passed, 36 suites | Existing behavior and new IndexedDB isolation/replay/logout |
| Production browser matrix | 16 passed, 2 skipped, no failures | 15 functional flows across Chromium/Firefox/WebKit plus Chromium mobile throttle |
| Accessibility/mobile | Passed automated Axe tags and overflow assertions | WCAG2 A/AA, 2.1 AA, 2.2 AA; 320/360/375/390/412/768/1280 px |
| Frontend build/lint/format | Passed | Vite production bundle, ESLint, v2 Prettier |
| Backend static/format | Passed | Ruff on new v2/domain/repository/migration tests |
| Code security | Bandit zero findings | v2, domain and ownership repositories |
| Dependency security | npm zero vulnerabilities; exact Linux runtime no known vulnerabilities | Lock/runtime inventory at audit time; not permanent assurance |
| Migration | Passed | Clean upgrade, downgrade-base/re-upgrade, Alembic drift check |
| Backup/restore | Passed | Actual pg_dump/pg_restore; empty disposable databases only |
| Database inventory | `v2_0004`, 17 tables, 61 constraints, 55 indexes | Extension tables excluded from destructive autogeneration |
| Docker model | Passed without network | Non-root Linux compact inference, 38 labels; not accuracy evaluation |
| Complete local containers | API, worker, PostGIS, Redis exercised | Persistent named volumes, non-root writable caches/private objects |
| Local load | 100 authenticated reads, concurrency 8, 0 errors | 95.72 requests/s, p50 82.86 ms, p95 105.67 ms, max 154.36 ms |
| Local resilience | Passed Redis and PostGIS stop/restart | Readiness 503 during outage, 200 after recovery; Redis API fail-closed; worker heartbeat recovered |
| Throttled mobile | Sign-in visible in 4.024 s | Fresh Chromium 360 px, 400 ms latency, 50 KB/s download, CPU×4; map/planning bundles absent |
| Documentation | Required index and relative links checked | README, current guide, dataset status and v2 runbooks |

Backend skips: live CDSE processing without credentials; Windows additionally
skips Linux-only compact runtime. Browser skips: CDP performance emulation on
Firefox/WebKit; their functional flows still pass. No mandatory local functional
test was silently skipped.

WebKit's Playwright offline emulation fails service-worker navigation due to
[upstream issue 42775](https://github.com/microsoft/playwright/issues/42775).
Its test instead closes a real loopback proxy origin, reloads the cached shell,
queues a note, restores the origin, verifies synchronization and checks offline
logout/revocation. Firefox recovery is based on actual API probes rather than
assuming an `online` event will arrive.

Resolved findings included stale field selection after offline reload, missing
reconnection signals, late account/field responses, logout cache races, stale
Today cache after new evidence, extension-table Alembic drift, non-root Docker
cache paths, excluded public catalog files and a Keras-specific test assumption.

## External provider verification

A free public Open-Meteo smoke for a synthetic coarse location returned current
UTC data and 48 forecast intervals. This is provider retrieval evidence, not
field-weather validation. PM-KISAN public portal information was read and its
unsupported blanket tenant-eligibility claim removed. Existing Render, public
app and repository were inspected read-only.

CDSE live processing, real SMS delivery, production private object storage,
mandi-key retrieval, authorized government interfaces and paid speech were not
called. Missing keys remain blank. No money was spent, account purchased,
government form submitted or real farmer image/record used.

## Reproducibility and limits

Commands are in [testing](TESTING.md). Machine-readable logs/results are in
ignored `output/`: backend/Linux/frontend test logs, Playwright report/traces,
database verification, local load/resilience, mobile performance and security
inventories. Do not publish private artifacts. The IAB proof screenshot is
`output/screenshots/v2-today-final.png` and explicitly shows synthetic development.

[GitHub workflow](../../.github/workflows/v2-quality.yml) independently repeats
Linux backend/migrations/security, frontend/build/browser and container gates.
Check [per-commit runs](https://github.com/Thanatos9404/krishyak/actions/workflows/v2-quality.yml)
for GitHub execution status; a local test is not a CI execution.

These results do not certify physical phones, public deployment latency/capacity,
production backup restoration, commercial provider terms, security penetration
testing, scientific remote-sensing quality or farmer impact. See
[known limitations](KNOWN_LIMITATIONS.md).
