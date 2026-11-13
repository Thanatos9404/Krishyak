# Release verification report

Date: 3 October 2026, India. Branch:
`feat/krishyak-v2-field-intelligence`. All account/device evidence below is
synthetic and local. Earlier failed runs were repaired and repeated; the counts
below refer to passing release checks, not baseline or guessed results.

| Gate | Recorded result | Scope |
|---|---|---|
| Windows backend | 230 run, 228 passed, 2 skipped | Complete suite plus real disposable PostGIS |
| Linux backend | 230 run, 229 passed, 1 skipped | Release image, real PostGIS, public parity catalogs mounted read-only |
| Foundation | 30 passed | OTP/session/ownership/consent/geometry/rights/jobs/context/pilots |
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
| Throttled mobile | Sign-in visible in 4.024 s | Fresh Chromium 360 px, 400 ms latency, 50 KB/s download, CPUÃ—4; map/planning bundles absent |
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
GitHub additionally exposed topology/TIGER extension-table drift and newline
normalization of the hashed label map. Migrations now manage only the v2 namespace,
and the original label-map bytes are preserved across checkouts.

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

## Field services release, 12 November 2026

Branch `feat/farmer-ui-revamp`. Local runs used PostgreSQL 16 + PostGIS 3.4
and Redis inside WSL; accounts were synthetic and deleted afterwards.

| Gate | Recorded result | Scope |
|---|---|---|
| Backend | 332 run, 330 passed, 2 skipped | Whole suite on real PostGIS, including 13 field-service tests (Pest Radar thresholds and privacy, claim photos, groups, Verify verdicts, crop calendar) |
| Frontend unit | 385 passed, 62 suites | Adds picture guides, guide library parity with server guidance, alert and calendar cards, offline photo queue and its clearing rules |
| Browser, production build | Field services 6 of 6, product flows and passkeys passed (Chromium and the Pixel 7 profile) | Includes a real service-worker run: guides open with no signal, a leaf photo is saved, survives a reload, and is checked once after reconnecting |
| Accessibility and layout | No axe violations (WCAG 2 A/AA, 2.1 AA, 2.2 AA) on the new screens; no horizontal overflow | Ten screens at 1440, 1024, 768, 390 and 320 px; emulated viewports, not physical phones |
| Translations | 22 packs, 2,583 strings each, 0 structural failures | Script, placeholder and glossary checks only; native review still required |
| Dependency audit | pip-audit and npm audit report no known vulnerabilities | pyasn1 0.6.5; glob and minimatch pinned by override |
| Live staging | 9 of 9 on schema v2_0011 | Real passkey, weather, leaf model, private storage, Copernicus job, Sarvam voice, spoken setup, claim pack, calendar, Pest Radar, Krishyak Live, guides |

`scripts/smoke_staging.py` passed all 11 required checks on staging; its one
optional check, live mandi data, failed from Vercel Singapore. On 13 November
the provider log showed a `ConnectError` within about 100 ms from Singapore and
from Washington, and live prices from a Mumbai preview, so both projects moved
to `bom1`.

Repeated local runs hit the sign-up (10/hour) and recovery (5/hour) limits
by design; those counters were cleared in the local Redis only. Not covered:
physical Android or iOS devices, a real camera stream in Krishyak Live, a
Pest Radar alert built from real neighbouring farms (unit tests build one
from synthetic accounts), and any Google AI service.

## Provider checks on staging, 13 November 2026

A probe script signed up a throwaway staging account, called each external
service through the real API and deleted the account. Results after the
fixes below:

| Provider | Result on staging (Vercel `bom1`) |
|---|---|
| data.gov.in AGMARKNET | Live prices (4 Jaipur markets for wheat). Before the region move it failed with `ConnectError` in about 100 ms from Singapore and Washington |
| Sarvam | Chat (`sarvam-105b`) for setup and the assistant, speech-to-text, text-to-speech: all answered |
| OpenStreetMap Nominatim | Reverse and search answered (about 20 to 340 ms) |
| ISRIC SoilGrids | Setup got the soil-map class once the pH unit fix shipped. Fresh points still take 13 s to over 60 s; the field-context card often times out at 20 s and says so |
| Background soil map | A field saved as "Sandy (regional guess)" was upgraded to "Loamy" from the soil map 22 s later, with a notice; revision unchanged |
| Open-Meteo | Field weather saved; the context card uses it as the IMD fallback |
| Leaf model + private Blob | Photo checked (201) and read back (200, image/jpeg) |
| Copernicus Sentinel-2 | Job queued (202); the browser journey drained one through the worker |
| Bhuvan | Off by default: timed out from India (28 s) and from Vercel |
| IMD | Needs government approval; not enabled |

`scripts/smoke_staging.py`: 12 of 12 checks passed, including the optional
live mandi check. `e2e/staging.spec.js`: 9 of 9 passed on the final commit.
Backend: 338 tests (2 skipped). Frontend: 386 Jest tests. pip-audit, npm
audit and Bandit report nothing.

Through the frontend proxy, 1 of 30 HTTP/1.1 requests from a script dropped
its connection once; repeat runs of 40 requests over HTTP/1.1 and HTTP/2 had
no drops, and requests sent straight to the API never dropped. Browsers use
HTTP/2 and retry such drops, and no browser journey has hit one.
