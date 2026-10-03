# India-first release candidate audit

Audit opened 2026-10-03 from the actual PR/API/browser/repository state before RC implementation. This is an incomplete-release baseline, not a completion report.

## Source and release state

- PR [#2](https://github.com/Thanatos9404/Krishyak/pull/2) is OPEN and DRAFT. Its latest head and clean local HEAD are `7425c0cf945a3b54c2cc96fd226aeafc6e2971af`, branch `feat/krishyak-v2-product-experience-seo`, base `feat/krishyak-v2-field-intelligence`.
- [CI run 37132210505](https://github.com/Thanatos9404/Krishyak/actions/runs/37132210505) completed FAILURE. Backend and container jobs passed; frontend unit/static/build/dependency steps passed; browser step failed; public crawl was consequently skipped.
- Exact browser result: 25 passed, 3 failed, 2 CDP-only skips, 3 serial successors did not run. All three onboarding/consent flows passed. Current failures are the route audit's unconditional Selected field assertion, including `/institution`, which intentionally omits the farmer field picker. Inspect artifacts and retain role-gate coverage when fixing readiness.
- Latest independent Windows WebKit run also exposed an offline-flow deadline. A real origin outage can leave `navigator.onLine` true; current observation submission ignores the application's known offline state and attempts a network write before queuing. Investigate and test the actual behavior.
- Vercel GitHub statuses for both frontend `krishyak` and backend `krishyak-api` report SUCCESS for this head. These statuses do not prove enabled v2 runtime or live providers. Explicit frontend preview from this source is https://krishyak-4eila1uqf-yashvardhan-thanvis-projects.vercel.app . Deployment CLI completed normally.
- Existing Render service inspected in the authenticated browser: https://krishisaarthi-api.onrender.com ; free Python service, production environment, branch `main`, last deployed commit `03452a1a22b046feb204a4f3c02c38d444b27dc2`. It is not a matching PR #2 staging API. Its dashboard warns of inactivity cold starts of 50 seconds or more. No paid upgrade or production branch change made.

## Runtime and provider configuration

- Local Windows/PowerShell, Node 24 runtime for builds, Python 3.12 venv, Next.js 16.3.8/React 19.3.0. Existing Docker PostGIS/Redis/API/worker environment and isolated local E2E API are preserved.
- Secret-safe inspection of `backend/.env` found a nonempty Sarvam key. Its value was never printed. V2 database/auth/Redis/S3 bucket, Twilio Verify credentials, CDSE credentials and OGD key are blank there. Local synthetic test configuration exists separately and must not be deployed as real identity.
- V2 settings currently require Twilio, TLS PostgreSQL, TLS Redis and private S3 for deployed environments; development OTP is prohibited there. Other legitimate OTP adapters need research before changing this contract.
- Satellite adapter/worker and Open-Meteo context exist. Remote soil integration requires implementation. OGD market/provider and current source validation require re-audit. Existing public speech routes and local speech limiter are not sufficient evidence of authenticated, distributed, production-safe new-workspace speech.
- Next preview currently defaults to the production API alias unless explicitly configured. Matching isolated staging API, migrations, private storage, distributed limiter and durable worker remain required.
- Bounded HTTP checks during this audit: local `/api/v2/status` 200 with expressly development identities and disabled satellite; deployed Vercel API `/api/v2/status` and `/health/live` both 404. Render `/health/live` timed out at 12 seconds; that does not establish failure given the dashboard's cold-start behavior.

## Product, localization and performance

- Existing planning has 23 locale modes, including 22 static Sarvam-generated packs (Hindi metadata lists 981 strings, `sarvam-translate:v1`, machine translated and needing native review). New workspace strings remain hardcoded English, `lang=en`, with an explicit fallback banner. Complete core-workspace extraction/generation and all-language QA are required; existing coverage cannot stand in for them.
- Existing STT/TTS adapters/hooks exist outside the focused farmer workflows. Current capabilities describe Saaras v3 and Bulbul v3; TTS has a smaller language list than STT. Verify official current capabilities and implement secure workflow integration/fallbacks without claiming universal provider coverage.
- Current public hero provenance explicitly identifies Indonesian rice fields. Replace with licensed Indian photography and hash every derivative. Existing premium design, original content and local script fonts should be retained.
- Public SSR/SEO implementation covers nine pages, sitemap, robots, canonical/schema, redirects and genuine 404; private/preview noindex is implemented. Local crawl previously passed nine public pages, 20 resources, zero orphans. Re-run against final code and deployed preview.
- Latest raw local strict 360px anonymous sign-in measurement is **9,411 ms**, at 400ms RTT, 50,000 bytes/sec, 4x CPU. Earlier report's 9,177 ms is superseded. Prior 18-run Lighthouse series is historical; final RC measurements must be repeated, including Hindi and authenticated Today.
- Existing UI report's 31-pass matrix is historical and is contradicted by current CI. It is not release evidence for this head. Reports will be corrected as each gate is actually verified.

## Required completion evidence

All numbered requirements in the new user brief remain in scope: resilient per-purpose consent; green complete CI; India geography/units/phone/onboarding; all 22 static workspace locales plus English with semantic QA/RTL/offline/fonts; authenticated and budget-protected STT/TTS; real provider provisioning/smokes where legitimate no-spend access exists; satellite/soil/official market/weather caching and provenance; farmer-first legacy-surface replacements; genuinely isolated full-stack staging and restore drill; final multi-engine multilingual accessibility/security/load/performance/live-browser evidence; updated provider/environment/language/security/test/cost reports; logical commits and a pushed clean branch.

External access, compliance, billing, native review and human field trials must be recorded accurately. Missing implementations are not external blockers. No provider is LIVE VERIFIED merely because a mock or deployment job passed. No spending is authorized.

## First correction under test

CI artifacts confirm all three route failures occur on `/institution` with the correct farmer access-denied view present. The corrected audit explicitly waits for that signed-in role gate and verifies absence of privileged cohort creation, while retaining all nine route/width/Axe checks. Observation writes now honor the application's known outage instead of relying solely on browser connectivity. Consent now has separate per-purpose pending/rollback/retry/cancellation state; server-confirmed consents still control processing. Focused tests passed 16 assertions, including the HTTP failure matrix and account switch; full unit/build/browser results will be added after completion.

First correction verification: 326 tests / 47 frontend suites passed; formatting, ESLint and production build passed. The complete production browser run passed **31 tests with two CDP-only skips, zero failures**, including actual-origin WebKit offline reload, queued write, idempotent reconnect and sign-out. Logs: ignored `output/product/rc-consent-unit.log`, `rc-consent-build.log`, `rc-consent-browser.log`. This verifies the consent/offline correction stage, not the entire new India-first RC. Phone/area changes being developed separately were not included in that build. Latest CI remains the failed baseline until the correction commit is run on GitHub.

Authenticated Sarvam billing inspection found existing credits available and auto top-up not configured, with no payment history. No credit purchase, paid plan or auto-recharge was enabled. Static generation and tiny live smokes can use the user's existing credits with bounded usage. Official references: [translation model](https://docs.sarvam.ai/api/getting-started/models/sarvam-translate), [billing](https://docs.sarvam.ai/api/platform/billing), [SoilGrids fair-use](https://rest.isric.org/), [Firebase pricing](https://firebase.google.com/pricing), [MSG91 default OTP widget](https://msg91.com/help/sendotp/how-to-integrate-the-new-login-with-otp-widget/msg91-otp-widget-subscription-). Provider selection is still under investigation; no production OTP claim is made.
