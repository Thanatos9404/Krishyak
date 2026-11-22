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

## Accuracy and onboarding release, 20 November 2026

Branch `feat/accuracy-onboarding`. Local results on Windows with PostGIS and
Redis in WSL; accounts were synthetic and deleted afterwards. Staging results
are recorded separately once this branch is deployed there.

| Gate | Recorded result | Scope |
|---|---|---|
| Backend | 367 run, 365 passed, 2 skipped | Whole suite on real PostGIS: district yield table, rainfall normals, registration lookup, example field, price fallbacks, usage statement, leaf decision rule and input size |
| Frontend unit | 402 passed, 65 suites | Dashboard cards, four-step registration, usage card, picture guides for the new crops |
| Browser, production build | 21 of 21 (Chromium): public pages, field services including the offline journey, product flows, passkeys | A real leaf photo is checked by leaf model v2 through the API, online and after an offline save |
| Layout | No horizontal overflow, no console errors | Home, field report, example field and institution screens at 1440, 1024, 768, 390 and 320 px; emulated viewports, not physical phones |
| Leaf model v2 | See `MODEL_GOVERNANCE.md` | Evaluation on 16,557 held-out photographs; export equivalence on 247 inputs; serving-path check on 1,735 original photographs |
| District yield model | See `YIELD_MODEL.md` | Time-split test on 2022-23 and an out-of-time check on 2024-25 |
| Translations | 22 packs, 2,784 strings each, 0 structural failures | Script, placeholder and glossary checks only; native review still required |
| Static checks | Ruff, Bandit, ESLint and Prettier pass; npm audit reports nothing after Next.js 16.4.6 | |

Found and fixed during this round: the first fine-tune of the leaf model
returned a non-finite loss because the mixup coefficient was computed from
three independent draws instead of two; that run was discarded and the
corrected run is the one released. Sarvam's document translation moved its
upload storage to another host, which the Sindhi script's allow-list
rejected until that exact host was added.

Translation used existing Sarvam credits (an estimated 745 across the two
runs, including Sindhi); nothing was purchased.

### Staging, 20 November 2026

Staging database migrated to `v2_0012` through the HTTP migration step;
the switch was set back to `false` and the endpoint answers 404 again.

| Check | Result |
|---|---|
| `scripts/smoke_staging.py` | 12 of 12, including live mandi data |
| `e2e/staging.spec.js` | 9 of 9 on the final API build: passkey sign-up, GPS field with live weather, a real leaf photo checked by leaf model v2 in the LiteRT runtime and stored privately, a Copernicus job drained by the worker, market, voice answer, registration from GPS and speech ending on the dashboard, calendar with Pest Radar and a claim pack, Krishyak Live with the picture guides |

Two defects were found by the staging runs and fixed before the final pass:

- **Instance stall.** One run returned 503 from the location lookup and the
  voice read-aloud at the same instant, 30 seconds after they started, while
  three ordinary reads hung with them. The request log showed the cause:
  async endpoints re-read the session on the event loop after a provider
  call, and when the three-connection serverless pool was full the loop
  blocked until the pool timeout. The re-read now runs in a worker thread,
  the pool per instance is larger and its wait is 8 seconds. This had been
  latent since the voice endpoints were added.
- **Empty crop comparison.** The field report never listed other crops
  because a loop variable shadowed the crop being assessed. It now compares
  the other crops of the season that the district is recorded as growing,
  with a test that the list is not empty.

A status poll in the staging journey now retries once on a dropped
connection; the drop happened seconds after the staging address was moved
to a new build. Layout was re-checked with a 14-hectare field so that
seven-digit amounts fit the dashboard cards and the comparison table at
320 px.

## Leaf model v3 and Indian farm photographs, 21 November 2026

| Gate | Recorded result | Scope |
|---|---|---|
| Data audit | 103,530 photographs kept; 22,854 from documented Indian farms | `LEAF_DATASETS.md`; the older unverified rice photographs were found to be the Odisha set, and one "Indian" set's maize images to be studio copies |
| v2 on Indian photographs | 94.9 % on 3,659 held-out photographs of sources it trained on; 92.2 % on 933 Pune cotton photographs it had never seen; 48.3 % on 300 Kashmir and Jalgaon photographs it had never seen | Crop selected |
| Retrained network | Better than v2 on field and Indian farm test photographs (p = 0.012, 0.021), worse on the unseen farms (p = 0.029) | Exact McNemar test, `leaf_v2/compare.py` |
| Weight averaging | No gain: validation macro-F1 dips between the two networks | `leaf_v2/soup.py` |
| Released model (two networks, predictions averaged) | 95.7 % Indian farm test, 91.7 % field test, 83.4 % PlantDoc, 47.0 % unseen Indian farms | `MODEL_GOVERNANCE.md` |
| Overfitting check | Field photographs: 97.1 % training, 91.3 % validation, 91.7 % test; validation still rising at the last epoch | `metrics.fit` and `learning_curve` in `release.json` |
| Export equivalence | Same top class and decision on 247 inputs; largest probability difference 1.5e-6 | `runtime-verification.json` |
| Serving path | 5,694 original photographs through the LiteRT artifact | `serving-check.json` |
| Backend | 368 run, 366 passed, 2 skipped | Adds mirror-averaging and decision-rule tests |
| Frontend unit | 402 passed, 65 suites | |
| Translations | 22 packs, 2,785 strings each, 0 structural failures | Four account-change messages that the refactor of 20 November had hidden from the extractor were restored |
| Staging | `e2e/staging.spec.js` 9 of 9 with `krishyak-leaf-v3` deployed | The 70 MB artifact builds and serves on Vercel; a real leaf photo is checked in about the same time as with v2 |

## Price sources, 21 November 2026

data.gov.in's mandi API returned HTTP 502 for part of the day (its website
stayed up), which left the app with stored quotes only.

| Gate | Recorded result | Scope |
|---|---|---|
| Source survey | One usable addition | Agmarknet 2.0 market-level reports answer `TOKEN_OR_CAPTCHA_REQUIRED`; eNAM's price endpoints return a page shell; CEDA needs registration and is non-commercial; the Agmarknet 2.0 dashboard table of all-India averages is open |
| Backend | 375 run, 373 passed, 2 skipped | Parsing and refusal of odd tables, which figure leads, outage behaviour, caching of failed reads, the nightly job, the price used by the field report |
| Frontend unit | 406 passed, 65 suites | National card, ordering, compact Home card, crop preselection on the market screen |
| Live local run | Wheat in Jaipur: Bassi APMC quote of the day leads, all-India average below. Soybean in Jaipur: no local quote, all-India average leads | Real data.gov.in and Agmarknet responses once the outage ended |
| Layout | No overflow at 1440, 768, 390 and 320 px | Market screen, Home card, field report |
| Translations | 22 packs, 2,799 strings each, 0 structural failures | |

Also fixed: the market screen opened without the farmer's crop and place
when those loaded after the screen, so no price showed until a crop was
picked; and the field report named a fixed support-price year.

### Dropped connections through the frontend, 22 November 2026

Two staging runs of this change failed for a reason outside it: once the
browser's `GET /api/v2/plots` got no answer for 20 seconds although the API
had answered in 1.3 seconds, and once a request was reset before any answer.
A sample of 40 small requests to production through the frontend lost 1
(and several took more than 5 seconds); 40 sent straight to the API lost
none; a later sample of 120 through the frontend lost none. The frontend's
logs show only successful forwards, so the loss is between Vercel's edge
and the forwarded request, and it comes in bursts.

| Gate | Recorded result | Scope |
|---|---|---|
| Frontend unit | 409 passed, 65 suites | A read with no answer is sent again after 8 seconds; a broken read is sent again at once and succeeds silently; a read with a longer wait set by the caller is not repeated on timeout; a write is never sent twice; nothing is retried offline; a cancelled read is never repeated |
| Staging | `e2e/staging.spec.js` 9 of 9 | Sign-up, weather, leaf photo, satellite job, market page, voice, registration, calendar and claim pack, Krishyak Live |
| Staging prices | Wheat in Jaipur: Bassi APMC quote of 21 November leads, all-India average of 20 November below. Soybean and rice: all-India average leads. Apple: local quotes only | Checked against the Agmarknet table read directly on the same day |
| Nightly job | 404 without the secret, 200 with it | Counts only in the answer |
