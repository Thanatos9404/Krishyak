# Krishyak repository audit and readiness record

Updated 7 September 2026. **Work is ongoing; this is not a national-production readiness certificate.** Existing worktree edits were preserved. No deployment or production-model replacement has been performed.

## Verified improvements

| Area | Failure found | Implemented correction / evidence |
|---|---|---|
| Disease inference | Hash-derived diagnoses, invented image-search scores, healthy results overridden | Actual classifier only; unavailable, invalid image, unsupported crop, crop mismatch and uncertainty remain explicit. Bundle labels and input/output shapes checked. |
| Yield | Zero fertilizer could improve yield; excessive fertilizer rewarded | Zero/empty equivalence and excess-dose regression checks. Baseline source/year/product basis exposed. Model explicitly identified as an agronomic heuristic. |
| Costs | Market fee based on a fixed amount; monthly irrigation counted once; fractional-hectare fertilizer cost incorrect | Fee calculated from revenue, irrigation charged over supplied season duration, per-hectare and total costs separated. No free seed-quality upgrade. |
| Scenarios | Global RNG repeatedly reset; price shocks overwritten; supplied pest risk ignored; sale horizon truncated | Local reproducible generator, preserved shocks and input parameters, 12-month horizon, scenario fallback when proposed changes reduce profit. |
| Price series | Reverse dates, ambiguous Indian dates, multiple markets mistaken for consecutive days, substring crop collisions | Day-first parsing, daily aggregation, chronological ordering, exact crop matches and finite statistics. Persistence forecast instead of an unvalidated trend or fabricated best sale date. |
| Nutrients | Zero soil values treated as absent; assumed ppm conversion; DAP cap could leave P deficit or excess N | Preserve zero and unknown separately. N-constrained DAP plus SSP. Chemical basis explicitly N/P2O5/K2O; unspecified soil P/K basis is not subtracted. Generic recipe is not a soil-test prescription. |
| Weather/pests | Random government outbreaks and historical events; unavailable rain shown as zero; empty feeds labelled safe | No invented outbreaks or history. Failed weather remains unavailable. Hourly forecast samples retained. UI no longer claims favorable conditions or a safe pest zone from absent feeds. |
| API / privacy | Missing validation, blocking inference, proxy-header trust, Aadhaar saved in CSV, demo verification enabled | Finite bounded farm inputs; synchronous calculation routes dispatched through FastAPI's threadpool; bounded uploads; opt-in trusted proxy; registration consent and CSV escaping; raw Aadhaar no longer saved; demo identity disabled by default. |
| Local runtime | Venv pointed to a missing interpreter; startup scripts depended on launch directory; Windows Unicode logging failed | Local venv repaired; module-based invocations and anchored batch paths; JSON logging escapes Unicode. |
| UI persistence | Old computation results and unrelated pest caches reused | Versioned simulation cache; context/version checks on pest cache; preserved form inputs without reusing obsolete results. |

Additional verified corrections: source-linked 2026/2026-27 MSP records; acres-to-hectares conversion; all 36 state/UT choices with free-entry district/tehsil; atomic soil writes and collision-resistant device filenames; observation-based cache age; missing sensor values rejected instead of invented defaults. CropIn connectivity now requires a fresh reading. Sensor vendor contracts still require verification against authorized live services.

Browser sessions now tolerate corrupt or unavailable storage, scrub Aadhaar on restoration/login/update, filter legacy drafts, and clear farm caches on logout. Local profile state is not server authentication.

Market/location audit follow-up: mandi endpoints now preserve provider unavailability, reject invalid limits with 422, and distinguish an empty valid provider response. Missing credentials skip the network request. Cached records are isolated from caller mutation. The calculation adapter applies state/district filters, requires a positive finite dated price, rejects future records, and marks older observations stale instead of inventing a default price. Mock contract tests cover these paths; authorized live-market verification is still pending.

Broken district/tehsil imports were replaced with a shared frontend/backend suggestion catalog and tested API endpoints. Responses disclose partial coverage and permit free entry. This is not an official LG Directory integration or a verified current administrative-boundary dataset.

Inference follow-up: invalid probability distributions (non-finite, wrong shape, negative/out-of-range or non-normalized values) cannot produce diagnoses. Runtime/model failures return service unavailability rather than invalid-image errors. Image resources are closed and float32 preprocessing reduces transient memory. Class-based crop metadata supports newly trained labels. This is reliability validation, not improved accuracy or out-of-distribution calibration.

Pest follow-up: removed the mock geographical contribution and overlapping bounding-box state assertions from scoring. Weather/season suitability weights are normalized without that contribution and explicitly identified as uncalibrated. Weather inputs are required and finite, December/January proximity wraps correctly, and unsupported seasonal crops remain unavailable. Prediction cache version 3 invalidates older regional scores. A real regional outbreak integration remains a release requirement.

Fertilizer follow-up: absent growth stages no longer add an extra one-third dose. Basal organic amendments are not repeated at every stage. Tests verify nutrient conservation across every configured crop schedule, fractional-area costs, zero-dose stages and invalid inputs. pH alone no longer triggers an amendment instruction. These remain generic recipes rather than validated soil-test prescriptions.

Equivalent soil readings do not trigger duplicate requests merely because the parent constructs a new object. Delayed-response tests resolve the new crop before the old one and verify all three result types.

Frontend fertilizer cache now includes area, stage, organic preference and soil inputs, expires after one day, and rejects old cache formats. Cache write failures do not erase live results, stale recommendation, schedule and alternative requests cannot overwrite newer results, and logout clears this cache. Zero-dose schedules remain valid results with an application explanation.

Registration follow-up: the browser and API reject irrigated/rain-fed area sums exceeding total land in the selected unit; optional zero/blank/partial entries remain valid. Field validation rejects non-finite values. The registration timestamp is assigned on receipt by the server. An isolated temporary-file API test verifies persistence and Aadhaar exclusion. This does not establish identity verification or production database durability.

Scenario follow-up: stress transformations no longer improve seed quality or reduce pest risk at extreme inputs; the proposed control adjustment no longer reduces an already-high intensity. Scenario parameter snapshots are deep copies. Sample counts reject booleans/fractions/zero, and complete comparison tests cover unchanged inputs, Monte Carlo summaries and the existing-profit fallback. These checks validate implementation consistency, not agronomic calibration.

Coverage measurement before these five additional scenario tests: **56% combined statements/branches across backend**, including training utilities (77 tests). Main API: 53%; simulation engine: 45%; yield estimator: 100%. This does not mean every function is tested. The report at `.codex-tmp/backend-coverage.json` identifies uncovered paths; training scripts were exercised separately but not instrumented by this unit-test run.

Weather follow-up: hourly forecasts reject null/non-finite/invalid values, missing hours and insufficient horizon coverage. The seven-day summary requests eight calendar days to retain 168 future hourly samples after local midnight filtering, following https://open-meteo.com/en/docs . Invalid horizon inputs are bounded at both API and service levels. Live provider verification at public coordinates (20.5937, 78.9629) returned 168 contiguous hours from 2026-09-06T23:00 to 2026-09-13T22:00 local time. Tests cover genuine zero rain separately from missing data.

Soil observation follow-up: repeated polling no longer adds duplicate observations, delayed data cannot replace the newest cached measurement, and invalid/wrong-device readings are rejected before writing. API responses calculate staleness from the actual returned observation. Newer cache fallback respects `use_cache=false`; history ranges are validated. Five isolated observation/API tests cover these behaviors, including repeated old manual readings and a lagging provider.

Soil frontend follow-up: unavailable responses clear obsolete readings even with fallback disabled; offline timestamps describe the measurement, not the cache write. Delayed responses cannot replace a newly selected plot, stale/cached readings do not claim a live connection, and manual payloads cannot override the selected device ID. Local cache clearing resets displayed state. Four hook tests cover unavailable refresh, offline age, plot races and submission targeting.

Price/risk follow-up: non-finite historical prices are excluded before daily aggregation. Old or invalid provider quotes cannot override a user-entered quote; uncertainty interval overflow is explicit unavailability rather than invalid JSON. API price bounds leave room for internal sensitivity shocks. Tests cover sparse observations and extreme history. Risk output identifies component evidence and distinguishes assumed price baselines from measured historical dispersion. Historical dispersion does not establish future stability or a best sale date; unsupported claims were removed from insights.

## Dataset provenance and training evidence

- [PlantVillage publisher repository](https://github.com/spMohanty/PlantVillage-Dataset), revision `7f7ecc7e1eaca78107e3affe7cb5abd9427e139a`. Color originals and official leaf map retained. Unused grayscale/segmented copies and the downloaded Git archive were removed to recover disk space; source revision and per-image hashes remain recorded.
- [PlantDoc publisher repository](https://github.com/pratikkayal/PlantDoc-Dataset), revision `5467f6012d78d1c446145d5f582da6096f852ae8`, publisher CC-BY-4.0 license. Windows-invalid filenames exported safely with original-path and hash provenance. Web-sourced field-like photographs are not an independently collected Indian-farm benchmark.
- The existing `pdisease` collection has **unverified provenance and licensing**. It is identified separately in manifests; it is excluded entirely from the publisher-only run.

The corrected combined manifest contains 68,853 images and 77 labels before training-support exclusions: 6,440 duplicates removed, five corrupt images excluded, 91 conflicting-label images quarantined. Published PlantDoc test images are reserved. Physical leaf IDs, identical decoded pixels and identical perceptual hashes are grouped before splitting. Existing validation matches are held out from training and model selection. This does not prove removal of every near duplicate or common farm/session; that requires additional source metadata.

| Run | Trained classes | Internal test top-1 | External partition top-1 | Decision |
|---|---:|---:|---:|---|
| Existing recorded model evaluation | 42 | 78.10% on its original 3,173-image evaluation | Not established | Original deployment retained; this test is not directly comparable to the new partitions. |
| `authentic-v3` (publisher + explicitly unverified legacy) | 71 | 92.61% / 9,908 images | 54.35% / 230 images | Fails accuracy gate; not promoted. External partition includes 229 PlantDoc and one grouped legacy image. |
| `publisher-finetuned-v1` | 38 | 91.78% / 8,566 images | 50.22% / 229 PlantDoc images | Eight fine-tuning epochs; worse than frozen candidate; not promoted. |
| `publisher-efficientnet-v1` | 38 | 93.22% / 8,566 images | 54.59% / 229 PlantDoc images | Frozen EfficientNetV2B0; field gate failed; not promoted. |
| `publisher-only-v1` | 38 | 92.72% / 8,566 images | 53.28% / 229 PlantDoc images | Fails accuracy gate; not promoted. Covers 14 publisher crop categories. |

Six legacy labels in the combined run have no remaining training support after leakage prevention: Army worm, bollrot on Cotton, Cotton Aphid, pink bollworm in cotton, thirps on cotton and Wilt (1,047 images). They are explicitly excluded and recorded, not claimed as supported. The earlier `authentic-v2` result is **superseded** because a filename-grouping bug was subsequently discovered; do not use its 94% result as a final claim.

Training actually ran locally with TensorFlow 2.20 and a frozen ImageNet MobileNetV2 backbone plus a trained weighted classifier head. Domain weights emphasize PlantDoc. Model selection uses validation loss only; evaluation reports include per-class results, balanced accuracy, macro F1, confusion matrices and Wilson intervals. These are exploratory development runs, not an untouched release benchmark. A further run unfroze the last 35 backbone layers, kept batch normalization frozen, and used augmentation and a low learning rate. It resumed after an interrupted process; this is disclosed in its metadata. Its results did not improve. GPU training has not yet run: the Windows TensorFlow runtime sees no CUDA GPU, and the attempted CUDA PyTorch installation ran out of disk space. Large-image decoding memory use was corrected without deleting those valid images.

Artifacts are under `backend/training_runs/<run>/`: `model.keras`, `class_indices.json`, `manifest.json`, `data_audit.json`, `evaluation.json`, prediction arrays and confusion matrices. Candidate loading is available through `KRISHYAK_DISEASE_BUNDLE`; changing it is not evidence that a model passed the release gate. Training does not overwrite the default model.

**The requested >93–94% field accuracy and superiority over NPSS have not been achieved or established.** A paired benchmark using the same held-out images, crop/condition taxonomy and decision rules is required for an NPSS comparison. The [government NPSS description](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2114896) is not such a benchmark.

## Verification completed so far

- `backend/venv/Scripts/python.exe -m unittest discover -s backend -p "test_*.py"`: 115 passing tests across calculation, integration, storage, security, sensor, prediction metadata, training-cache, cloud dataset-restoration, registration persistence and rate-limit contracts.
- From `frontend`, `node node_modules/react-scripts/scripts/test.js --watchAll=false --runInBand` with `CI=true`: 124 passing tests across thirteen suites.
- Production build succeeded using `CI=true GENERATE_SOURCEMAP=false node node_modules/react-scripts/scripts/build.js` from frontend after a concurrent build/test attempt exhausted system memory. Source maps were disabled for this local verification only. Existing dependency-data age and testing-library deprecation warnings remain.
- Local browser flow: old simulation cache invalidated, current form submitted, dashboard/scenario/recommendation responses received, calculated revenue and costs rendered; weather and pest unavailable states displayed without false favorable/safe messages.
- Installed 42-class model smoke test through updated preprocessing/inference: actual cotton bollworm validation image returned a disease result; this verifies runtime execution only, not aggregate accuracy.
- All 68,853 manifest images decoded with the training Pillow runtime. Dataset and inference regression tests verify specific leakage/abstention failures.

These checks do **not** yet cover every repository function, every language, every device or every live external integration. Coverage expansion is part of the continuing work.

## Remaining release requirements

1. Train/fine-tune a model that passes a representative independent field benchmark, with per-crop coverage, healthy controls, non-leaf/unknown rejection and calibration; compare with NPSS only using paired evidence. Review publisher attribution and legacy licensing before any dataset redistribution.
2. Calibrate yield/risk/price algorithms against geographically and temporally held-out observations. Generic static crop norms, labour/input costs and sensitivity ranges are assumptions, not validated national agronomy. Cotton's baseline is lint; kapas prices cannot be used as lint prices.
3. Complete authenticated government/identity integrations. Existing Aadhaar/land/bank code contains demo implementations and cannot establish a real person's eligibility. Default-disabled demos are a temporary honesty fix, not completion of this requirement.
4. Maintain live weather and market schema/date validation. MSP snapshots were updated from official releases; scheme data still needs review. Distinguish a sandbox network restriction from a provider outage. Missing API credentials cannot be fabricated.
5. Add durable per-farmer authenticated storage, tenant isolation, consent retention/revocation, backups and production secrets. Local JSON/CSV and process memory do not establish safe national multi-user operation. Review existing stored records separately; this audit did not delete user data.
6. Expand function/endpoint tests and real browser flows, accessibility/localization checks, concurrency/load tests and failure/recovery checks. Review deployment persistence and resources, dependency vulnerabilities, privacy and operational monitoring. Successful local build alone is insufficient.

Next actions should address these requirements and update this record with actual evidence, not reinterpret partial checks as completion.

## Additional candidate started 7 September 2026

The publisher-efficientnet-v1 run completed on the same 56,833 publisher-only records and preserved partitions. Validation accuracy: 94.11%; internal test: 93.22% (95% Wilson interval 92.67–93.73%); external PlantDoc test: 54.59% (48.11–60.91%). The field gate failed and production is unchanged. Feature caches now require matching backbone and manifest metadata, validate shape, and remove their completion marker before replacement extraction. Existing completed model directories cannot be overwritten. Colab was subsequently signed in by the user. A new notebook connected to a Tesla T4 (15,360 MiB); TensorFlow 2.20.0 detected its GPU. Cloud training setup is in progress; the publisher-efficientnet-v1 run remains local CPU. Repeated use of these evaluation splits makes them development evidence; a new independent field benchmark is still required.


Soil frontend follow-up: validate complete numeric ranges, measurement timestamp and matching device identity before accepting live/manual/offline readings. Reject inherited cache keys and invalid cache shapes. Filter history records by the same contract. Added nine regressions; all 120 frontend tests and production build pass.

Colab workflow prepared in notebook 1IznIzIO0AqsDevv0pP5RUr9G6oGOLrob. The T4 GPU was verified, and the training cell is waiting at Choose Files for backend/training_runs/krishyak-colab-input.zip (32,096,466 bytes; SHA-256 f5f9c07f365bda055a33c7b25347bdd949f02df8e7ba6eb926d069d6c4005439). The official local MCP bridge did not complete its browser handshake. No cloud model training has started yet. The upload cell validates the bundle checksum; the bootstrap verifies exact publisher image hashes before training and evaluates all preserved held-out splits afterward.


API resilience follow-up: rolling rate limits use a monotonic clock and a lock, expire inactive clients globally, and cap tracked clients without evicting active quotas. CORS wraps request middleware so preflight is not quota-charged and early 429/500 responses remain readable by the frontend. Request IDs are bounded ASCII and consistent across HTTP error headers/body. Six additional regression tests cover rolling boundaries, concurrency, capacity, invalid limits, preflight/CORS and trace correlation. Shared cross-replica rate limits and production authentication remain unresolved release requirements.


Registration follow-up: the frontend now waits for backend success before creating its local profile and clearing the draft, revalidates all steps, blocks duplicate submissions and shows a retryable error on failure. Raw Axios error objects containing farmer payloads are no longer logged. Backend CSV writes use OS file locks, reject incompatible/truncated existing files, flush before success and roll back a failed append. The write runs in a worker thread; storage failures return a generic 503. Four frontend regressions and four backend regressions were added; production frontend build passed. Local CSV exports still do not provide production authentication, tenant isolation, cross-host durable storage or idempotent retries.

Latest Colab check: the notebook remains saved, but its prior GPU runtime/upload execution is no longer active. Current UI reports a CPU runtime and an expired upload widget. No cloud training result exists; the bundle still needs upload and a T4 runtime before the prepared training cell can proceed.


Dependency security audit (7 September 2026): the original lightweight Python requirements produced 20 advisory entries across FastAPI, Starlette, python-multipart and python-dotenv. Updated framework/parser/HTTP/validation pins and made Render reuse the common runtime pins. Re-auditing requirements.txt reports no known vulnerabilities; pip check passes; all 115 backend tests pass in the updated environment. The installed ML environment is being audited separately. Npm compatible updates changed the lockfile, upgraded Axios to 1.20.0, and reduced findings from 58 (including two critical) to 31 (9 low, 8 moderate, 14 high, zero critical). The only direct package remaining flagged is react-scripts; forced npm fixes propose a nonfunctional 0.0.0 replacement and were not applied. All 124 frontend tests and production build pass after these updates. Reports: frontend/dependency-audit.json and frontend/dependency-audit-after.json; Python reports are in .codex-tmp. These are database checks, not proof of absence of vulnerabilities.


Broader installed-environment audit initially reported 65 advisory entries across 15 installed packages, including Keras 3.12.0, Pillow 12.0.0, scikit-learn 1.3.2 and ancillary tooling. This finding is superseded by the patched-environment verification below; the original report remains in .codex-tmp/python-installed-audit.json for traceability.

## Patched ML runtime and Colab status — 8 September 2026

Updated Keras to 3.15.1, Pillow to 12.3.0, scikit-learn to 1.9.0 and affected supporting packages, with shared security constraints for reproducible installs. The installed-environment audit now reports zero known vulnerabilities (.codex-tmp/python-installed-audit-after.json), and pip check reports no broken requirements. This is a database audit, not a guarantee that no vulnerabilities exist. The frontend still has the 31 previously recorded dependency findings.

Compatibility verification: all 56,833 publisher-only manifest images decode with identical pixel hashes under Pillow 12.3.0; no manifest was modified. Keras 3.15.1 loads both the candidate and existing production model. Recomputing predictions for 32 internal and 32 external examples preserves every predicted class, with maximum probability differences below 0.000002. These are compatibility checks, not a new aggregate accuracy evaluation. All 115 backend tests pass after the updates; the latest frontend verification remains 124 tests and a successful production build.

The replacement upload bundle is backend/training_runs/krishyak-colab-input-v2.zip, SHA-256 9bda3f61c540bc9a08f9084a0f99d4704a1920e540d516b2ee743d4757860ac7. It supersedes the old ZIP and includes patched dependency pins. It contains public-data training code, the candidate model and manifest metadata; it contains no farmer records or dataset images. The saved Colab notebook 1IznIzIO0AqsDevv0pP5RUr9G6oGOLrob now references this checksum and dependency file.

On 8 September, attempting to connect the notebook to T4 produced Colab's explicit "Cannot connect to GPU backend" message due to account usage limits. No paid compute was purchased and no cloud training has started. Resume when GPU allocation is available, upload the v2 bundle, then retain the resulting evaluation artifacts. The >93–94% independent field accuracy and paired NPSS comparison remain unachieved; production has not been promoted.

## Frontend toolchain migration — 8 September 2026

Replaced react-scripts 5.0.1 with Vite 8.2.2 / React plugin 6.1.1 and standalone Jest 30.5.1 with explicit Babel and jsdom configuration. npm audit now reports zero known vulnerabilities, superseding the 31 remaining findings recorded above. npm removed 962 obsolete packages during the migration. Test-only dependencies are now development dependencies. The lockfile, startup/build commands, JSX entry point, HTML entry and Vercel framework setting are updated together. Production output remains build/, and REACT_APP_API_URL remains the explicit API endpoint override without exposing unrelated environment variables. Refer to the official [Vite guide](https://vite.dev/guide/) and [Jest setup documentation](https://jestjs.io/docs/30.0/getting-started) for the replacement toolchain. Node 22.12+ is required by this repository.

All 124 existing tests pass in 13 suites under standalone Jest. Both the default production build and a production build targeting the local API pass. Browser verification of the latter loads the real local crop/soil catalogs, switches language, submits a fresh simulation and renders scenario comparisons. The API logs confirm the fresh simulate/recommend requests. The production-default API was inaccessible during the browser check; this is not evidence of a working deployed backend. Local weather retrieval remains unavailable. The main JavaScript chunk is about 273 KB gzipped and triggers Vite's size warning. CRA's implicit lint integration is no longer part of the build; standalone static-analysis coverage remains follow-up work.

Additional observed follow-ups: recommendation processing took 29.8 seconds and scenario processing 40.5 seconds in the local flow, and scenario copy still implies live agricultural price data despite estimates using entered prices. These require correction and dedicated evidence; the migration does not establish national release readiness. Broken favicon/apple-touch references now use the existing project PNG.

## Scenario performance and price provenance follow-up — 8 September 2026

The two issues immediately above have now been addressed. Profiling 30 samples showed 66 repeated commodity-history filters consuming most calculation time. Each comparison now prepares crop baseline, price history and risk statistics once in a request-local context; every Monte Carlo sample still runs with the same seed, variations, forecast, costs and risk formulas. Standalone calculations retain their uncached path. Contexts cannot be used for a different crop, are rebuilt on each request, and are not stored on the shared engine. Yield estimation also avoids retrieving the same baseline twice.

A 300-sample comparison measured 4.748 seconds with uncached sample calculations versus 0.220 seconds with request-local observations (21.6x), with exact equality of the complete returned result. Concurrent in-process API calls returned HTTP 200 in 0.551 seconds for 500-sample /compare_scenarios and 0.548 seconds for /recommend. This is a local measurement, not a deployed latency SLA or national load test. Four regressions cover reference equivalence, unchanged sample statistics, per-request observation refresh and wrong-crop rejection.

## Simulation request and saved-result isolation — 8 September 2026

Found that failed calculations could restore another set of farm inputs' saved results, and logout removed browser storage but left result state visible in memory. Saved simulations now use schema version 3, a 24-hour maximum age, valid timestamps/basic numeric result structure and exact comparison of all submitted farm inputs (including nested fertilizer quantities). Old schema results are invalidated. Restored results carry a saved-data label. Changing inputs clears the displayed results; logout clears results and resets inputs. Request sequencing and an input snapshot prevent late responses after input changes, logout or unmount from writing result state, browser storage or success messages. API requests have a 30-second timeout, and incomplete success envelopes are rejected.

Three App integration regressions exercise late response/input changes, result clearing and pending-response logout. Seven cache cases cover matching inputs/property order, changed crop/area/fertilizer, old schema, malformed results, missing data, expiry and future timestamps. All 138 frontend tests in 16 suites pass; the production build passes. This does not implement authenticated cross-device accounts. Catalog loading still needs independent-response handling, a retryable unavailable state and isolation of storage-write failures from successful API results.

## Catalog loading recovery — 8 September 2026

The catalog follow-up above is implemented in useFarmCatalog. Crop and soil requests update independently; one failed request does not discard the other response. Catalogs must contain unique nonempty strings. Each saved entry has its own timestamp and is reusable for at most seven days, only with the matching API endpoint. Missing, malformed, expired, future-dated and foreign-endpoint entries are rejected. Storage write failures leave successful responses intact. Request sequencing prevents an older request from overwriting a newer retry, including after unmount. Registration and the main app show translated loading/saved/unavailable states and a working retry button.

Eleven hook cases and one App integration case verify partial failure, retry recovery, storage quota failures, invalid catalog shapes, cache expiry/provenance and delayed-response ordering. All 150 frontend tests in 17 suites pass. Catalog availability does not establish that external identity, weather, mandi or model services are ready; the broader release requirements remain open.

## Risk display consistency — 8 September 2026

Removed a contradictory "safe" explanation for moderate scores and the default zero/zero-start animation. Missing, nonnumeric, nonfinite or out-of-range gauge scores are unavailable. Backend and frontend now categorize the published score consistently: <=25 low, >25–50 moderate, >50–75 high, >75–100 severe, without rounding a fractional score into a lower tier. Category labels use the returned two-decimal score. These thresholds are presentation conventions for an uncalibrated index, not measured loss probabilities.

Replaced the risk pie chart, which normalized independent components into misleading percentages, with individually labelled 0–100 meters. Zero remains a valid value; absent components remain unavailable. The overall meter is accessible and immediately exposes the actual value; the semicircle uses equal quarter-scale segments. Heuristic low-pest input no longer turns into a translated claim of a low-risk season, and heuristic rainfall suitability uses forecast-monitoring guidance instead of claiming observed favorable weather. Simulation limitations remain visible.

Eighteen frontend cases cover score boundaries, invalid values, component scales and cautious insight mapping. The frontend has 168 passing tests in 18 suites; production build passes. A backend boundary regression was added; this change affects category labels, not the numeric risk calculation. Broader agronomic calibration and evidence-grounded localized advice remain release requirements.

## API error disclosure follow-up — 8 September 2026

Many endpoint catch blocks constructed HTTP 500 errors from raw exception messages. The shared HTTP exception handler now suppresses that detail for 500 responses. Unexpected errors are generic in development as well as production, with matching request IDs in response bodies and headers. Explicit client statuses and headers such as Retry-After remain intact. Main API error logs and RequestLogger no longer include raw exception text or traceback exception payloads; they retain exception type, operation context and trace identifiers. Provider modules' own logs still require separate review.

Image upload handling preserves an explicit HTTP rejection, treats invalid image signatures as a 400 client error with a controlled message, and treats an unexpected file-read failure as a server error. Five new tests exercise wrapped engine failures, preserved status/headers, unexpected exceptions in development, invalid image handling and safe request-error logging. All 125 backend tests pass. Frontend code was unchanged in this follow-up; its latest evidence remains 168 passing tests and a successful build. This addresses error disclosure, not authenticated per-farmer data isolation.

## Disease UI integrity follow-up — 8 September 2026

Found a remaining explicitly labelled demo path that assigned the first local disease and a fixed 82% confidence after an artificial delay. Removed that path: the sample button now only loads the real sample photograph into the upload flow. Only an actual classifier response can create a diagnosis. Removed the unverified hardcoded "detectable diseases" listing and the fallback claim of five supported crops. The selector now uses validated capabilities from an available model; failures show unavailable/retry rather than invented coverage.

Changing crop or image clears the old result and invalidates outstanding work. Analysis and sample fetches use AbortController with finite deadlines, and sequence checks prevent stale responses or file previews from updating a newer selection. Unmount aborts current work. Preview read failures remain explicit. Three component tests cover missing capability/retry behavior, sample loading without fabricated inference, and a diagnosis arriving after a crop change. The full frontend suite has 171 passing tests; production build passes. No model was retrained or promoted in this change, and field-accuracy gates remain unmet. Local treatment metadata still needs source and applicability review.

## Standalone static analysis restored — 8 September 2026

Added supported ESLint 10, core recommended JavaScript rules and React Hooks checks. ESLint 10 provides native JSX reference tracking ([official release notes](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/)); the incompatible legacy React lint plugin was removed. npm run lint scans src/, and npm run build now runs lint before Vite. Runtime requirements are Node 22.13+ within 22.x or Node 24+, matching the installed linter. Initial scan found zero errors and eleven unused variables/parameters; removed dead declarations and a redundant always-true filter. Also replaced an unsupported fixed 10–15% yield-loss claim in fertilizer validation with soil-test confirmation advice.

Final report: 80 source files, zero errors, zero warnings, seven existing inline suppressions. Suppressions remain visible in frontend/lint-report.json and still require review; this is not proof of absence of bugs. All 171 tests pass and lint-plus-production build passes. Existing bundle-size warning remains. Automated loading-progress percentages and completed-step indicators are still timer-driven rather than backend progress and need follow-up.

## Truthful loading state — 8 September 2026

Removed timer-generated percentages and completed-step markers from LoadingOverlay. The API exposes no intermediate progress, so the overlay now shows an indeterminate pending status controlled only by the actual request state. It has an accessible live status and busy state, a decorative spinner respecting reduced-motion preferences, and no timer callbacks. Two regressions verify that waiting never creates progress/completion claims and that request completion/retries control visibility. All 173 frontend tests in 20 suites pass. This resolves the timer-driven progress follow-up above; request timeout/recovery and inference accuracy remain separate concerns.

## Location autofill evidence — 8 September 2026

Removed unsourced city/state soil and rainfall tables from the location API. The former fallback silently supplied Alluvial soil, 800 mm rainfall and zero monsoon delay. No verified farm-soil, seasonal forecast or observed onset integration is currently configured, so those fields now return null and do not overwrite manual inputs. Geolocation, reverse-geocoded place names and current weather remain available independently. The button now says Detect location; agronomic values display unavailable/manual entry instead of auto-filled. Reverse geocoding has a finite timeout, and the geolocation fallback timer is cleared on settlement.

Three regressions cover mapped/unmapped places without invented values, successful geolocation with unavailable agronomic fields and preservation of manually entered soil/rainfall/delay. All 176 frontend tests in 22 suites pass. This deliberately removes false automatic agronomic detection; verified soil and seasonal weather integrations are still required for that original feature to be complete.

Scenario price attribution now renders manual entry for user-supplied prices, preserves a supplied source label/date, and never infers a live feed merely because freshness is missing or unspecified. Persistence forecasts retain the simulation disclaimer. Existing translated manual-entry, price and unavailable labels are reused across locales. Four frontend cases cover entered prices, missing metadata, a lone live flag and stale provenance. All 119 backend tests and 128 frontend tests pass, including complete literal translation-key coverage; the production build passes. Broader calibration, authentication, official integrations and disease-model release gates remain open.


## Current weather response and lifecycle validation — 8 September 2026

Location weather now checks UTC timestamps, current-reading freshness, coordinate bounds, numeric temperature/humidity bounds and recognized WMO codes. It selects the next eight contiguous forecast hours rather than the beginning of the daily array. Missing/invalid precipitation invalidates the forecast instead of becoming zero; valid zero readings are retained. Rain showers are distinguished from thunderstorms using the publisher's [weather-code documentation](https://open-meteo.com/en/docs). Requests have a 15-second deadline. Current observations and the hourly forecast can be unavailable independently; no seasonal agronomic prediction is inferred from this short forecast.

Location refresh clears previously displayed readings. Unmounted components ignore outstanding responses, cannot overwrite parent inputs, and clear toast timers. Failed reverse geocoding no longer labels an unknown location as India. Nine API regressions and two component regressions cover invalid/stale inputs, missing rain, zero values, future forecast selection, unmount and failed refresh. All 187 frontend tests across 24 suites pass; lint and production build pass (the existing bundle-size warning remains). Latest backend evidence remains 125 passing tests; backend code was unchanged in this follow-up. These checks establish response integrity, not local forecast accuracy or agronomic calibration. Field-model accuracy, paired NPSS evaluation and production integration requirements remain open.

## Diagnosis response contract — 8 September 2026

The crop-health UI now validates an available-model diagnosis before rendering it: disease identifiers/names must be nonempty strings, confidence must be a finite probability, severity must be recognized and the returned disease crop must match the selected crop (including established aliases). Healthy responses require confidence and cannot contain a conflicting disease. Malformed optional advice lists are discarded rather than passed as React children; unrecognized-status messages must be text. Local disease metadata lookup is restricted to the selected crop, and server prevention advice is now rendered instead of silently ignored.

Fourteen contract cases and two component integration cases cover malformed confidence/identity/advice, crop mismatch, valid diagnosis rendering and prevention advice. All 203 frontend tests in 25 suites pass. Lint and production build pass; the existing bundle-size warning remains. These checks prevent malformed response rendering and cross-crop enrichment; they do not establish confidence calibration, treatment validity or field accuracy. Treatment metadata and the high-confidence wording still need evidence review before national deployment.

## Confidence presentation follow-up — 8 September 2026

Removed UI-only 85%/60% thresholds that assigned high/medium/low confidence tiers and a strong-visual-match tooltip without calibration evidence. The validated raw classifier probability is displayed neutrally to one decimal place, including for healthy-class predictions. Existing localized model limitations and field-confirmation advice now appear at readable size above recommendations/treatments instead of in a small footer. No probability was recalibrated or changed.

Component assertions verify the numeric score, absence of high-confidence wording, limitation text preceding treatment and the healthy-result path. All 204 frontend tests pass; lint and production build pass with the existing bundle-size warning. The legacy healthy-result headline still overstates a classifier result in several locales and needs coordinated translation review. A clearer localized model-score explanation, calibration evidence and sourced treatment metadata remain necessary; this change does not establish diagnostic accuracy.

## Disease severity provenance — 8 September 2026

The image classifier previously assigned each predicted disease a fixed low/medium/high severity from static metadata, including a medium fallback for unknown classes. It has no lesion-area or field-severity estimator. Inference now returns null severity with severity_source=not_measured; the UI displays the existing localized unavailable label. The response parser accepts absent severity and also neutralizes static severity sent by older servers, without rejecting an otherwise valid crop diagnosis. This preserves classification while removing an unsupported measurement claim. A validated severity estimator remains required to provide that measurement.

Inference assertions check the explicit unmeasured contract; frontend contract coverage verifies legacy static values become unavailable and null severity still permits diagnosis. All 125 backend and 205 frontend tests pass. Lint and production build pass with the existing bundle-size warning. Healthy-result headline translations and sourced treatment metadata remain open, alongside field accuracy, calibration and the broader production requirements.

## Transparent camera/upload preprocessing — 8 September 2026

Verified existing EXIF orientation handling and added pixel-equivalence coverage for rotated versus upright uploads. Fixed transparent image conversion: RGBA, grayscale alpha and palette transparency now composite onto white before RGB resizing, preventing invisible color channels from becoming classifier evidence. The upload preview uses the same white background. Opaque RGB preprocessing remains unchanged; this changes predictions for transparent uploads and is not a model accuracy improvement claim.

Three new backend tests cover full/partial alpha, palette transparency and EXIF equivalence. All 128 backend tests pass. Frontend lint and production build pass; latest frontend test evidence remains 205 passing tests (only a background CSS class changed in this follow-up). Bundle-size warning and broader field-validation requirements remain open.

## Deferred feature loading — 8 September 2026

Moved comparison, recommendations, crop diagnosis, market cards/charts, registration, MSP detail and legal pages into dynamic feature imports. Each feature has a localized pending state and an error boundary with retry; retry creates a fresh React lazy instance so a rejected import promise is not permanently cached by React. The surrounding app and entered farm inputs remain mounted during feature download/retry. Browser module cache and missing deployment assets may still require a reload; no offline availability is promised for never-downloaded features.

The production main JavaScript chunk decreased from 943.67 kB / 267.66 kB gzip to 804.67 kB / 233.31 kB gzip (about 12.8% less compressed entry JavaScript). Additional chunks download when their features render; this is an entry-payload measurement, not a measured mobile latency improvement. Dashboard dependencies remain eager and the size warning remains. Two tests cover deferred loading, current props and failed-download recovery without losing surrounding inputs. All 207 frontend tests pass; lint and production build pass. Full browser navigation across the new chunk boundaries remains to be verified.

## Production browser navigation and sidebar identity — 8 September 2026

Used the available CUA browser because the skill's agent-browser CLI is absent. The built app rendered Dashboard, Crop Health, Market, registration, MSP detail, Privacy and Terms through real navigation. Hosted API requests failed in this environment: crop/soil catalogs and disease capabilities showed unavailable/retry, and mandi prices showed a recoverable error. These observations verify feature rendering, not functioning hosted integrations or complete browser-console cleanliness. Simulation-dependent Scenarios/Insights could not be exercised against the inaccessible hosted API.

Browser navigation revealed that App declared SidebarContent as an inner component, remounting the sidebar on parent renders. Replaced it with an element-rendering helper so Sidebar identity remains stable. This prevents parent updates from discarding sidebar-local state and restarting its effects. A regression verifies local input state survives farm-input and async catalog updates. All 208 frontend tests pass; lint and production build pass. Browser evidence also exposed unnamed back/search/season controls on the MSP detail page, requiring an accessibility follow-up. No registration was submitted and no production data was changed.

## MSP controls and sorting — 8 September 2026

Fixed unnamed MSP back, search and season controls using existing localized accessible labels. Sortable table headers now contain native keyboard-operable buttons and expose aria-sort; column scope is explicit. Crop ordering follows localized displayed names through Intl.Collator. Numeric sorting returns zero for equal prices, preserving stable ties instead of using a contradictory comparator. Search trims surrounding whitespace and normalizes Unicode before matching both source and translated names; it still combines with the season filter.

Two regression tests exercise named controls, back action, combined search/season filtering, displayed-name ordering, stable equal-price ordering and Enter/Space sort activation. Keyboard events are wrapped in React act to flush updates before assertions. All 210 frontend tests in 27 suites pass. Lint and production build pass. This addresses the specific unnamed controls found in the previous browser pass; it is not a full accessibility audit. MSP values were unchanged, and field accuracy/hosted API/production requirements remain open.

## Model cache and class-map integrity — 8 September 2026

Verified the existing model-load lock and tightened bundle validation. Class maps must be nonempty dictionaries with exact consecutive canonical string keys (0, 1, ...), nonempty string names and no duplicate names. The former integer-conversion check accepted a key such as 00 even though prediction looks up 0. Rejects malformed/multi-output model shapes before publishing the cache. Four tests cover concurrent first loads, malformed maps, no partial cache, recovery after a corrected bundle and unsupported output shapes.

All 132 backend tests pass. A separate real TensorFlow load verified the installed production model still loads with input (None,224,224,3), output (None,42) and 42 labels. No model weights or class labels changed. Concurrency tests establish single initialization, not national-scale throughput or concurrent inference capacity. Latest frontend evidence remains 210 tests and a successful lint/build; frontend files were unchanged in this follow-up.

## Colab GPU recovery and verified transfer — 9 September 2026

The free T4 runtime became available again. The notebook's GPU check previously executed successfully with a Tesla T4 (15,360 MiB) and TensorFlow 2.20.0. The output-widget iframe upload failed to expose a file-chooser event, but the top-level Files > Upload to session storage route worked. An initial session did not retain its upload after reconnection; the new transfer was verified in the session file panel and by the executing notebook's SHA-256 assertion: 32,097,204 bytes, digest 9bda3f61c540bc9a08f9084a0f99d4704a1920e540d516b2ee743d4757860ac7.

The saved notebook now reads that exact session ZIP directly, checks its checksum and extraction paths, installs evaluation dependencies, then runs pinned-image restoration, fine-tuning and evaluation. The bundle builder now also supports an existing session ZIP without forcing the iframe upload widget. At this checkpoint notebook Cell 1 is executing bootstrap; no training completion, metrics or promotion are claimed. Keep observing this live cell rather than restarting it. Notebook: https://colab.research.google.com/drive/1IznIzIO0AqsDevv0pP5RUr9G6oGOLrob .

## Colab Python compatibility and execution visibility — 9 September 2026

Inspected the live notebook through Colab's terminal: pip PID 4373 waited on build-metadata child 4462 under Python 3.13. The explicit NumPy 1.26.3 pin supports only Python 3.9–3.12 ([NumPy release notes](https://numpy.org/doc/2.0/release/1.26.3-notes.html)), forcing an unsuitable source-build path. Interrupted the unsuccessful installer and verified PID 4373 was a zombie and its build child had exited before changing setup. Removed the extra old NumPy pin and require binary wheels so unsupported dependencies fail promptly rather than attempting long source builds.

The notebook generator now streams subprocess stdout/stderr to the cell and appends training-session.log, propagating nonzero exit codes. A test generates a notebook in a temporary fixture workspace, compiles its actual logging function and verifies success output, failure output, persistent logs and exit-code propagation. All 133 backend tests pass. The cloud cell was updated with these changes; Colab disconnected and allocated a replacement GPU runtime, so the public ZIP is being restored again. No epochs or new evaluation metrics have been produced yet. Do not treat the previous quiet installer as a completed training run.

The replacement runtime accepted the same checksum-verified ZIP, and corrected setup has now started successfully with visible wheel downloads for Python 3.13. The runtime selected compatible NumPy through the TensorFlow dependency requirements instead of the old forced 1.26.3 pin. The original source-build attempt was deliberately stopped because its incompatibility was verified, not because of a polling timeout. Continue observing the retained notebook cell for dataset-restoration and training output; no model metrics are available from this run yet.

## Training environment separation and data restoration — 9 September 2026

The live Colab run restored 54,284 PlantVillage images by their pinned publisher byte hashes and moved on to PlantDoc. A terminal count independently confirmed 54,284 restored files. This is verified dataset preparation progress; no training accuracy is implied.

For subsequent generated notebooks, dependency installation now targets a separate virtual environment through pip --python ([official pip documentation](https://pip.pypa.io/en/stable/topics/python-option/)). It runs pip check before training, records installed versions and includes that record and the session log in the result archive. This avoids replacing Colab's own requests/protobuf/setuptools dependencies. The live run was left uninterrupted, so its previously reported global-environment conflicts are not claimed fixed. The generated-notebook logging/syntax regression still passes; isolated GPU execution remains to be exercised. Latest full backend suite remains 133 passing tests.

PlantDoc restoration also completed: 2,549 verified images, bringing the restored total to 56,833. The fine-tuner created a Tesla T4 device with approximately 13.8 GB available and started Epoch 1/12. TensorFlow emitted a layout-optimizer error during graph setup; no terminal training failure was observed at this checkpoint. Monitor the same live cell for epoch completion or a traceback before deciding whether intervention is required.

## First GPU epochs verified — 9 September 2026

The live notebook produced two completed epochs despite the graph-layout warning: epoch 1 took 238 seconds (training accuracy 0.8907, loss 0.5264, validation accuracy 0.9350, validation loss 0.7603); epoch 2 took 213 seconds (training accuracy 0.8960, loss 0.5083, validation accuracy 0.9339, validation loss 0.7417). Epoch 3/12 began. These are development validation metrics, not held-out field accuracy or evidence of NPSS superiority.

A sampled nvidia-smi reading showed 27% GPU utilization and 633 MiB allocated earlier in epoch 1. Colab later showed Connecting/Resuming execution; no terminal failure was proven, so the run was not restarted. A command to record package versions was attempted through the terminal during reconnection but completion was not verified; do not claim runtime.json exists until inspected. The retained notebook tab remains the authoritative live handle.

### Colab runtime loss and recovery export (9 September 2026)

- Saved notebook output reached epoch 5/12, with four completed epochs; epoch 4 validation accuracy was 0.9381 and validation loss 0.7201. These are validation results only, not a completed evaluation.
- A fresh terminal inspection showed PID 1692 absent and both candidate model.keras and training.csv missing. `/content` contained only .config and sample_data. The replacement runtime has a Tesla T4 (15,360 MiB). Thus the prior training job is terminal and its temporary checkpoint cannot be recovered from this session; saved output must not be treated as a live process.
- The generated notebook now attempts to export partial candidate files and training logs after a Python-level failure or manual interruption. Export errors do not suppress the original training failure. This cannot protect against whole-runtime deletion; checkpoints must be downloaded before a session disappears.
- Generated-notebook tests execute the actual recovery branch for subprocess failure, KeyboardInterrupt, export failure, and success. The focused test passed. Regenerated the local v2 notebook; the public input bundle SHA256 remains 9bda3f61c540bc9a08f9084a0f99d4704a1920e540d516b2ee743d4757860ac7. The replacement runtime has not yet run this regenerated notebook.
- No new completed accuracy result or model promotion. Independent Indian field validation and a paired NPSS comparison remain outstanding.

### Replacement Colab run started (9 September 2026, 15:13 UTC)

- Uploaded the regenerated notebook and the unchanged public input ZIP to the replacement T4 session. The launch cell verifies notebook SHA256 d8ba5730aeb249a07035dd786ff6892b3448b308efc6ba8d032edb308891d42e before executing it; the notebook independently verifies input ZIP SHA256 9bda3f61c540bc9a08f9084a0f99d4704a1920e540d516b2ee743d4757860ac7.
- Isolated training environment installation completed and pip check reported `No broken requirements found.` Bootstrap passed its GPU-presence check and began restoring the pinned PlantVillage source. No completed replacement training epoch or evaluation is yet observed.
- Environment freeze is recorded by the notebook. This isolated run resolved NumPy 2.5.3, TensorFlow 2.20.0, Keras 3.15.1, Pillow 12.3.0 and scikit-learn 1.9.0; it is distinct from the lost session's global environment. Further runtime and candidate evaluation remain required.

### Fine-tuning resume identity checks and replacement GPU progress

- The replacement Colab bootstrap was observed live as PID 3453. Its fine-tuner PID 4068 created the T4 TensorFlow device and reached Epoch 1/12 in the isolated environment. No completed epoch or held-out result yet.
- Local fine-tuning resume now verifies the original parent weight SHA256 and exact manifest, class mapping and provenance files before copying metadata into an existing candidate. It also requires an existing checkpoint and a nonempty contiguous epoch history with finite nonnegative validation losses. Previously the candidate metadata could be overwritten before identity validation.
- Five targeted tests passed, covering matching identity, changed parent without mutation, changed manifest/labels/provenance, invalid history, and missing weights. These local changes have not been injected into the already-running cloud job; its uploaded bundle remains unchanged.

### Healthy diagnosis crop identity contract

- Healthy classifier responses now include the inferred crop, and frontend validation requires it to match the selected crop using the same supported aliases as disease responses. Missing or mismatched identities no longer render a healthy result.
- Backend tests cover healthy identity and rejection of a different requested crop; frontend parser tests cover missing/mismatched crop and the maize/corn alias. Existing rendered healthy-result tests use the updated contract.
- Verification: 210 frontend tests across 27 suites and 139 backend tests passed. Older backend deployments that omit healthy crop identity will be rejected by this frontend until the backend update is deployed together.
- Colab PID 4068 was observed live with GPU utilization 21% and 633 MiB allocated during epoch 1. No checkpoint existed at that inspection; do not infer training failure from the nonfatal TensorFlow layout optimizer message alone.

### First replacement checkpoint packaged; external preservation unverified

- Epoch 1 completed in 238 seconds: training accuracy 0.8907187581, validation accuracy 0.9350073934, validation loss 0.7602692246. Epoch 2 began. These remain validation metrics only.
- Packaged the candidate directory plus its environment freeze as /content/krishyak-checkpoint-epoch1.zip (44,789,809 bytes), SHA256 04ded215e34b8ab531226a637f6a63c9ddb6f2f5a14716c4af821450b54992e1. The archive was created during the next epoch, after CSVLogger recorded epoch 0.
- Colab file-panel download of the complete ZIP explicitly failed with `Failed to fetch`. Split the intact archive into 8 MiB transfer parts and attempted the smaller final part. No completed local artifact has been verified, so this is NOT a durable backup yet. Keep the runtime alive and continue recovery transfer investigation; do not restart the running trainer.

### Replacement training second epoch and browser transfer observation

- Epoch 2 completed in 227 seconds with validation accuracy 0.9339 and validation loss 0.7417; epoch 3 began. The notebook remained executing after a browser automation reset.
- Tracking the smaller file-panel download via the browser download event exceeded the tool timeout and reset only the browser automation bindings. The retained Colab tab was reacquired and still showed the active training cell. No training restart was performed and no local checkpoint transfer is claimed.
- Avoid repeating the same file-panel download loop without new evidence. The notebook's google.colab.files.download result export remains the next available distinct transfer mechanism after training/evaluation finishes.

### Completed Colab candidate recovered and evaluated (10 September 2026)

The notebook completed training/evaluation and its final export was found at C:\Users\yashv\Downloads\krishyak-colab-results.zip. This supersedes the earlier unverified checkpoint-transfer status. The archive is 47,527,492 bytes, SHA256 664729ac450a35641ed84a29f3bc722f0673c06376ae640743e2d502da693a37. It passed ZIP CRC checks and safe-path checks before extraction into backend/training_runs/publisher-efficientnet-colab-v1. Weight and manifest SHA256 values match evaluation.json; manifest, labels and provenance exactly match the audited parent bundle.

Training stopped after 11 epochs; the best validation loss was selected at epoch 8 (zero-based epoch 7). Final results for the selected checkpoint:

| Split | Correct / samples | Accuracy | 95% Wilson interval |
| --- | --- | --- | --- |
| Validation | 5112 / 5416 | 94.3870% | 93.7419–94.9691% |
| Internal test | 8027 / 8566 | 93.7077% | 93.1736–94.2026% |
| External PlantDoc test | 131 / 229 | 57.2052% | 50.7299–63.4428% |

All saved prediction paths and labels were matched against the manifest, probability distributions validated, and accuracies and confusion matrices recomputed. Local artifact_verification.json records these checks. Compared with the frozen EfficientNet parent, internal test gains were 161 corrected versus 119 newly wrong; external gains were only 12 corrected versus 6 newly wrong (paired exact p=0.238, not compelling evidence of a field improvement). These comparisons use already-reused development partitions and do not replace fresh independent testing.

The 94% confidence-bound gate failed. The candidate remains unpromoted. The separate 96.875% legacy-validation result is not a reliable field performance estimate and must not be used as a product accuracy claim. NPSS comparison, independent Indian field validation, and broad crop coverage remain incomplete. Final notebook output also explicitly confirms evaluation completion and gate failure.
