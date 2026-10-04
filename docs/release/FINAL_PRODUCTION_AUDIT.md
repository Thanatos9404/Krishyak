# Final production activation audit

Source snapshot recorded on 4 October 2026. Starting deployment evidence and new
local activation checks are distinguished below. CI runs after a source push;
the [PR #2 checks](https://github.com/Thanatos9404/Krishyak/pull/2/checks) record
the outcome for the pushed revision. Public staging and production activation
remain incomplete.

## Source and delivery

- Branch: `feat/krishyak-v2-product-experience-seo`.
- Fetched remote head and clean starting checkout: `a5e2410ec93ae6d6798d6d81f6479564bb20f605`.
- PR #2 remains draft, targeting `feat/krishyak-v2-field-intelligence`.
- PR #1 remains draft, targeting `main`; its head is `09068fadbfba43cbe216dd0e82e9235d374f1cd5`.
- Starting revision push workflow `37205222642` and PR workflow `37205225061`: backend, frontend/browser and container jobs all succeeded.
- Starting revision Linux evidence: 282 backend tests (one optional-provider skip), 347 frontend tests and 40 browser passes (two CDP-only skips). New changes require new verification; those counts do not certify them.
- Frontend Vercel deployment `4nxAUUroiE5dEYuRnJYW13asJ7VL` and API `kKBPD7jAA8bsojUXweeyVz6Pp4jN` succeeded. Protected API readiness, inspected with the authenticated CLI, reports `ready`, `v2: disabled`, `public planning only`.
- Production API origin remains `https://krishyak-api.vercel.app`; same-origin frontend rewrites are configured in `frontend/next.config.mjs`. A staging origin must be explicitly configured before staging is activated.

## Runtime infrastructure

Vercel production environment names do not yet include the v2 PostGIS, Redis, OTP, private object-storage and authentication settings. The existing Render API runs an older `main` revision and the inspected project contains no PostgreSQL or Redis resource. No production flag has been enabled, no release has been merged and no service has been purchased.

The local named disposable Docker PostGIS/Redis stack is verified engineering infrastructure. It is not a public staging deployment or production service. Durable worker and real phone OTP still require live deployment verification.

## Newly available accounts

- CDSE Sentinel Hub account is authenticated. Its dashboard shows 30,000 remaining monthly requests and 30,000 processing units, with zero overage allowance. No OAuth clients existed. A server-only client named `Krishyak staging satellite`, with the portal's 90-day expiry, is prepared. The final creation action is awaiting the computer-use confirmation; no secret has been issued yet.
- Bhashini onboarding dashboard is authenticated. API repository reports no keys. One Abhilekh speech-to-text application is `Sent for Review`; approved applications: zero. Portal login alone is not API approval.
- [Bhashini's documented public API](https://bhashini.gitbook.io/bhashini-apis) limits that access to proof-of-concept use and requests separate production arrangements. The adapter must keep a production approval gate.
- The initial Sarvam dashboard balance was 21,719.59 credits. After this activation work the navigation displays a rounded balance of 19,789 credits. Auto top-up was not configured; no purchase, recharge or card entry occurred. Text translation pricing is 2 credits per 1,000 characters, TTS 3 per 1,000 and STT 30 per hour. The initial bounded translation run reached its 1,500-request/1.2-million-character ceiling and preserved progress; its exact account bill was not reconstructed. The recorded continuation used 264 requests and 134,750 submitted characters (estimated 269.5 credits). A final cached publication used zero provider requests.
- [Current Sarvam documentation](https://docs.sarvam.ai/api/getting-started/models) lists scheduled-language transcription and translation, while Bulbul TTS supports ten Indian languages plus English. Configured capability and a real smoke test remain different evidence levels.

## Provider baseline and remaining verification

Open-Meteo fallback and public coarse Nominatim/LGD context have been live tested. Previous bounded OGD probes did not receive a usable response. IMD requires authorization; a guidance request was already sent and the last focused mailbox check found no reply. SoilGrids REST was disabled after the publisher pause. Bhuvan capabilities were unavailable. These need current bounded verification during this activation phase.

At the starting revision, the active workspace scope was English plus ten Indian languages, with 1,763 strings per pack. The final activation brief now requests all 22 scheduled languages, multilingual read-aloud and the public staging stack. Packs remain machine translated until actual native review; technical checks cannot establish semantic or agronomic approval.

Physical phones, native reviewers, agronomists and real farmers have not been evaluated by the automated checks. No capability is labelled field validated.

## Activation implementation and verification

All 22 scheduled Indian workspace languages plus English are now active in the
picker, profile contract, offline cache allowlist and test matrix. Each Indian
pack has 1,767 labels. All 22 pass current-source hashes, exact keys, placeholders,
protected glossary identities, critical-label translation and script checks.
Sindhi uses a separately verified document translation path with Arabic-script
guidelines, since Translate v1 returned Devanagari. The four-label probe passed;
the full public-label document submitted 44,459 text characters (estimated 223
existing credits, hard limit 250). Its provenance records the actual document
API and provider-managed model. Kashmiri, Sindhi and Urdu retain RTL layout.
Machine translation does not establish native semantic approval.

Private speech now uses authenticated, CSRF-protected and consent-checked STT
and TTS, with withdrawal/session checks after provider processing. STT supports
the documented 23 language codes and converts device recordings into validated
mono WAV of at most 30 seconds. Private requests use bounded provider transport
and distributed Redis budgets instead of the legacy host-local SQLite limiter.
Public legacy speech is disabled in hosted deployments. TTS selects a matching
local voice or a genuinely supported server language; Sarvam supports eleven
including English. Bhashini discovery is production-approval gated and rejects
unapproved inference URLs. There is no automatic paid retry or unrelated-language
voice substitution. Owner-scoped TTS audio has a bounded 120-second memory cache;
audio/text is not written to disk. Daily character/second budgets fail closed
when hosted Redis is unavailable.

Direct Sarvam synthetic TTS/STT probes passed for Hindi, Tamil and Bengali. A
separate live private-API Hindi smoke passed authentication, consent, TTS, STT,
no-store headers and rejection after withdrawal. Its 3.198-second public synthetic
recording was held in memory and the disposable account was removed. Neither
smoke represents real microphone accuracy, real phone OTP or public staging.
Per-language evidence is in [FINAL_LANGUAGE_VOICE_QA.json](FINAL_LANGUAGE_VOICE_QA.json).

The final local backend suite ran 295 tests successfully (293 executed passes,
two skips), alongside 405 frontend tests
across 65 suites, Ruff/formatting, Bandit and dependency advisory checks with no
known runtime vulnerabilities. The production frontend build succeeded. A fresh
backend container passed two runtime checks with network disabled. Disposable
migration upgrade/downgrade/upgrade, drift detection and PostgreSQL dump/restore
passed at schema `v2_0007` (18 tables, 65 constraints, 59 indexes). This restore
was of empty local verification databases, not production records. The public
crawl passed nine SSR pages and 21 internal resources with no orphans.

New exact-head GitHub verification is required before merging. The expanded
local suite passed 37 broad checks with two CDP-only skips; the three signed-in
all-language checks exposed the crop ambiguity described below. Those failed
cases are not certified by the 37 passing checks. The first bursty all-language run
hit the existing 500-request/minute API gateway. The matrix now paces successive
languages, retaining all route/search/save/export assertions and the production
quota. Failed intermediate runs are not counted as passing evidence.

The expanded matrix also exposed crop-label collisions in six packs. Eight
explicit Codex machine-draft corrections are tracked with source-key and method
provenance and retained by regeneration. A two-attempt, bounded Sarvam chat
review returned wrong scripts/identities and was not published. Static validation
and frontend tests now reject duplicate crop labels across the 62 canonical
identities. All 22 corrected packs pass those checks; the authenticated browser
rerun is required before release acceptance. This source snapshot does not count
that in-progress rerun as a pass. No native approval is inferred from these corrections.

The final slow-network entry sample is 7,047ms compared with the earlier 9,269ms
activation sample, about 24% faster under the same local CDP conditions. The
editable sign-in check also rejects anonymous session/refresh requests and the
3.6MB original-logo download. The supplied official artwork is unchanged; PNG
derivatives serve the header, favicon and PWA. No real-device/public-origin
performance result or two-second claim is made.

The worker can run a bounded batch (`--batch --max-jobs 3 --seconds 180`) from its
durable Postgres queue and exit for a managed scheduled runner. Its time window
is checked between jobs; it does not interrupt a job mid-transaction. Provider
calls retain their separate bounds. No managed runner has been deployed yet.
Default worker readiness remains ten minutes. A verified 15-minute runner would
need an explicitly configured stale threshold; no fabricated heartbeat or cron
deployment is reported.

## Subsequent CI and cleanup evidence

Revision `db0eaad8d0e4e5ca8d7ac276341a8a667cc5a39e` passed the complete PR
workflow `37224476967`: 295 backend tests (294 executed passes, one skip),
405 frontend tests and 40 browser passes with two CDP-only skips. The parallel
push workflow `37224474204` passed 39 browser checks and failed the WebKit
authenticated-language case on a five-second heading assertion. The retained
trace shows fast successful API responses and the correct Telugu heading in
the failure screenshot after delayed hydration. Functional route readiness now
has a bounded 15-second assertion, including the settings reload. No retries,
production quotas, data assertions or separate startup performance gate changed.
The next exact-head full workflows must pass before this adjustment is accepted.

The corrected local authenticated-language cases passed in all three engines
before that CI run. Cleanup then removed five generated fields, five empty
generated farms and five private test objects. A subsequent dry run found zero
generated fields, with My fields visibly empty and the public demo separate.
Future local browser runs must repeat guarded fixture cleanup afterward.

Both exact-head `db0eaad` Vercel preview builds succeeded. Authenticated CLI
inspection verified meaningful headings, titles, descriptions and canonicals
on all nine public preview pages, with deliberate preview noindex. API readiness
reported `ready`, `v2: disabled`, `public planning only`. This is preview evidence
and does not establish public farmer staging or production activation.

## Live provider rechecks and public staging blockers

A current keyed OGD probe with `limit=1` resolved DNS but failed to connect before
an HTTP response, so neither a working key nor invalid credentials are inferred.
Current coarse-city probes returned partial Nominatim data and Open-Meteo weather
fallback. SoilGrids stayed disabled and Bhuvan/OGD stayed unavailable, with no
fabricated soil or market result. The focused IMD mailbox query still found no
reply to the existing guidance request. Restricted partner integrations remain
disabled.

CDSE client creation and Neon Marketplace terms acceptance remain awaiting the
already-requested browser confirmations. Neon has not been installed. Verified
free-tier research is not provisioned infrastructure: Upstash documents a free
TLS Redis tier; Railway documents a no-card trial followed by a small free credit
and bounded cron tasks, which does not establish affordable continuous-worker
operation. Private S3 compatibility, TLS PostGIS/Redis, a genuinely deployed
worker and real OTP all still need live resource verification. No production flag
has been enabled, no draft PR has been merged and no paid service has been bought.
