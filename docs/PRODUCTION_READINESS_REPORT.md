# Production readiness review — 2 October 2026

## Assessment

Krishyak is a functional engineering MVP with useful safeguards and substantial automated coverage. It can support a controlled demonstration and a proposal to fund field validation. **It is not yet production-grade for unattended farmer advisory or storage of real farmer identities.** Passing software tests does not establish agronomic accuracy, privacy compliance, operational reliability, or commercial traction.

The reviewed starting revision was `71f836f` on `feature/krishyak-geoai-remote-sensing`, pushed before the audit. The audit continued through the deployment repair described in [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md). Public availability and scientific readiness are separate release gates.

## Verified engineering behavior

| Area | Evidence and practical limit |
|---|---|
| Automated checks | 199 backend tests: 198 passed, one live Copernicus test skipped. 283 frontend tests passed in 35 suites; lint and production build passed. |
| API and results | Real local browser requests to simulation, recommendation, and scenario comparison returned 200 and rendered results. Source labels distinguish rules, entered prices, stale/manual soil data, and unavailable feeds. |
| Registration | Draft validation, crop fallback and confirmed CSV writes are tested; a synthetic local registration completed. This is profile capture, not authenticated account creation. |
| Read aloud | Browser audio unlock and recovery are tested. A prior live Sarvam WAV request and browser playback completed. Device speaker/microphone permissions still require physical-phone testing. |
| Location | GPS-first context avoids asking for coordinates. A nearby device area is explicitly distinguished from a confirmed farm boundary. Weather and coarse climate context can populate automatically; soil nutrients and crop history remain unknown when no trustworthy source exists. |
| Satellite foundation | Typed geometry, geodesic area limits, cloud masks, NDVI/NDMI/NDRE, provenance, cache limits and transparent raster rendering have contract tests. Live imagery is conditional on Copernicus credentials, which were unavailable here. |
| Classifier packaging | Full float32 LiteRT inference preserves the selected 38-class model. All 247 conversion inputs matched top prediction and the 0.75 abstention decision, including 237 photos. Maximum probability difference: 0.00000659. This is numerical equivalence, not new diagnostic validation. |
| Dependency audit | After patches, npm audit and pip-audit of the isolated Linux production runtime reported zero known advisories. A remote cloud-image SBOM was not independently inspected. |
| Input safeguards | Numeric/finite checks, MIME/signature agreement, bounded uploads, decoded-image limits, redacted server errors, request IDs and restricted origins have regression coverage. |

## Release blockers for real farmer production

### 1. Identity, privacy and durable data — critical

`useFarmerSession.js` stores a profile in browser session storage. It does not authenticate an owner against the backend. Sensor read/write endpoints accept caller-supplied device IDs, and the default soil sensor uses `default`; there is no owner access check. The pest alerts API can return report records with precise coordinates and descriptions. These are code-inspection findings. No actual farmer identity was submitted and no existing records were deliberately modified during release checks.

Registration writes plaintext personal fields to local CSV, or temporary `/tmp` storage on Vercel. Local atomic writes and file locking improve write integrity but do not provide durable serverless storage, backups, identity recovery, authorization or deletion workflows. Browser logout does not remove the server record. Consent and government identity tokens are demo/in-memory mechanisms.

**Gate:** authenticated accounts or explicit anonymous mode; tenant ownership checks on every private resource; managed durable database with tested backup/restore and retention/deletion; aggregate public pest data and moderation. Collect minimal personal information only after these controls are verified. [OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) supports enforcing authorization for each request, independent of browser UI state.

### 2. Disease model field performance — high

The retained release metadata records validation accuracy **94.39%** on 5,416 samples and internal test accuracy **93.71%** on 8,566 samples. Its external test accuracy is **57.21%** on 229 samples, with a recorded 95% interval of **50.73–63.44%**. These metrics were read from the selected release; the original accuracy evaluation was not rerun during this audit.

The current classes cover 14 crop groups and exclude major requested crops such as rice, wheat and cotton. The classifier can abstain on low confidence or a selected-crop mismatch, but its softmax is not calibrated diagnostic confidence and there is no proven non-plant/out-of-distribution gate. Classification does not measure field severity. Satellite stress signals do not establish a pathogen diagnosis. Treatment content needs qualified agronomic review.

**Gate:** independent Indian field datasets, crop/region/season and phone-quality coverage, calibrated abstention, non-plant rejection, expert review and an escalation workflow. Preserve external metrics in all pitch materials; do not headline the older 96.875% legacy result as field accuracy.

### 3. Yield, profit and eligibility claims — high

The simulation uses agronomic rules and assumed Monte Carlo ranges. Price forecasting is an entered-price persistence baseline with no validated best selling date. This does not demonstrate realized yield or income improvement. Some translated UI copy still calls heuristic plans AI-optimized, implies selling-time optimization, or expresses pest-control input changes as a percentage crop-loss reduction without causal validation. The market forecast still says it is based on mandi trends despite the baseline using an entered price. A scheme card retains an MSP 2025�26 title even though the separate MSP rate card correctly displays the 2026�27 publication.

Scheme matching is indicative and can combine loan/noncash benefits into estimated support. It does not prove eligibility, government approval, entitlement or DBT receipt. Official Aadhaar/land/bank/PM-Kisan integrations are not live verified; demo identity verification is disabled by default. MSP is a source-linked published snapshot, while live mandi data requires a configured provider key and can be unavailable.

**Gate:** clearly labelled scenarios and assumptions, reviewed scheme calculations and terminology, authoritative eligibility verification where available, and controlled field measurement before impact claims.

### 4. Operations, scale and release discipline — high

The failed API deployment packaged 1,668.27 MB against a 500 MB Python limit. That packaging issue is repaired separately. Before the repair, the public frontend and API lagged the feature branch and `/remote-sensing/status` returned 404. A GitHub push alone therefore did not establish a working public release.

Health currently confirms process response rather than storage/model/provider readiness. Quotas and caches are primarily per process or local filesystem; serverless replicas do not share a durable global budget. General request throttling, public speech usage, provider cost controls and concurrency need multi-instance testing. No CI quality gate, restore exercise, SLO, incident runbook or integrated telemetry was found in the reviewed repository; hosting-side controls beyond deployment settings were not comprehensively inspected.

The repaired production runtime is now locked to audited versions. **Remaining gate:** CI release checks, readiness probes, shared throttling/quotas, monitoring, load/cold-start measurements and rollback rehearsal. Secure production configuration and staged promotion are necessary but do not resolve the account/storage gaps above.

### 5. Farmer experience and low-end phones — medium

Desktop and 320/390/768-pixel layouts were inspected and core navigation worked without horizontal page overflow. Hindi and Urdu locale packs loaded; Urdu switched to right-to-left layout. Mobile registration loaded without browser errors. Release QA with explicitly emulated Jaipur GPS populated current weather and the ERA5 baseline automatically; this does not verify physical GPS hardware. Several sidebar controls lack accessible names; keyboard and screen-reader coverage need improvement. The main JavaScript bundle is approximately 829 kB before gzip and the optional map bundle approximately 1,038 kB. A manifest and limited cached summaries do not establish a complete offline PWA. Some secondary data hooks lack bounded request cancellation. The satellite-unavailable panel still contains administrator/credential terminology that should be simplified for farmers. An uncertain image is shown as a message alongside a No Analysis Yet placeholder, which should more clearly distinguish a completed uncertain assessment.

**Gate:** physical Android/iOS GPS, camera, microphone and speaker testing; slow-network and low-memory budgets; accessible labels and keyboard focus; Hindi and regional-language field usability; truthful offline and permission-denied states. Automatic device location still requires the browser/OS permission and represents the phone's location, which may be away from the farm.

## What can be said to funders

**Supported:** working MVP; GPS-first nearby context; multilingual interface; real image classifier with explicit limitations; rules-based scenario planning; source-labelled weather/market/MSP context; documented numerical parity after runtime optimization; substantial regression coverage.

**Not established:** production certification; 95%+ field diagnosis accuracy; automatic soil lab measurements; satellite-only disease identification; proven income gains; official eligibility verification; robust identity/data protection; reliability at scale; comprehensive offline capability.

No user traction, retention, willingness to pay, acquisition cost, unit economics, field-partner commitments, intellectual-property position or dataset/provider commercial-license clearance was measured here. A credible grant pitch should fund an instrumented pilot and validation against these gates. A VC pitch needs that evidence alongside the product demo.

## Recommended acceptance sequence

1. Rehearse the verified deployed demo, including unavailable provider and uncertain-image outcomes; use labelled backup outputs if connectivity fails.
2. Complete private-data isolation and durable persistence before recruiting farmers with real identity data.
3. Have agronomists review advice and establish an independently measured field pilot, recording baseline practices and outcomes.
4. Add operational budgets, monitoring, shared quotas, accessibility and physical-phone checks before expanding the pilot.
5. Reassess readiness with measurable acceptance criteria and an independent security review.

This assessment covers the inspected repository, recorded model evidence, automated suites and selected real browser/API flows. It does not assert every physical device, paid provider, deployment region or failure combination was tested.

## Verified public release

Both components were promoted on 2 October 2026 from source commit `9bdf0e62e835920ff1d390614a9c17ffcaa23be2`. [Public app](https://krishyak.vercel.app) and [API health](https://krishyak-api.vercel.app/health) responded successfully. The API deployment is `dpl_4kgN8RYv3J3hJ6NMVjsxfkbv1bcM`; the frontend is `dpl_7eq8ZJEicLWsgDPSS1653dwy9ehu`. Authenticated candidate checks and public checks confirmed real image inference, synthetic speech transcription, TTS generation, CORS and production docs disabled. Actual browser simulation/recommendation/comparison requests returned 200.

Browser read-aloud completed with an actual audio-source start and end on retry. Its first synthesis request recorded status 0 and the UI showed a recoverable connection error; the release therefore does not demonstrate uninterrupted provider availability. Live mandi data remained unavailable without its provider configuration, and satellite imagery remained explicitly disabled without credentials. These capabilities were preserved in code rather than substituted with fabricated results.
