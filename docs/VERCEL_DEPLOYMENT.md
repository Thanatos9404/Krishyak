# Vercel deployment repair — 2 October 2026

## Root cause and repair

The failed `krishyak-api` preview (`6J5jWxaCXiLBLT8gVc62HjLu4jpj`, source `71f836f`) reported **1,668.27 MB**, exceeding Vercel's **500 MB uncompressed Python function limit**. The API previously bundled full TensorFlow/Keras and authoring dependencies. Python deployments do not automatically tree-shake them. See [Vercel Python packaging documentation](https://vercel.com/docs/functions/runtimes/python#controlling-what-gets-bundled).

The production API now uses **ai-edge-litert 2.1.4** and an unquantized, built-in-operator float32 export of the same selected EfficientNetV2B0 model. The 24,771,820-byte runtime artifact retains all 38 classes, preprocessing, treatments, crop checks, confidence threshold and response schema. Full Keras weights remain in Git and TensorFlow training/evaluation stays available through `requirements-ml.txt`; those files are excluded from the serverless upload. No remote model download, external inference service, retraining, class removal or quantization was introduced.

A lock protects shared interpreter state during concurrent inference, and artifact/label SHA-256 checks reject mismatched runtime bundles before caching. Tests cover isolation between simultaneous requests and corrupted artifacts/maps.

## Validation evidence

- 247 numerical comparison inputs, including 237 photos and ten deterministic synthetic tensors; **247/247 top predictions and abstention decisions agree** with Keras.
- Maximum absolute probability difference **0.0000065863**; full-vector tolerances `rtol=1e-4`, `atol=1e-5`.
- Same 247 comparisons passed on Linux Python 3.12 using LiteRT without TensorFlow.
- Linux API health, crop/soil catalogues, satellite status, classifier capabilities, speech capabilities and real sample-photo inference returned 200.
- 199 backend tests: 198 passed, one live Copernicus test skipped because credentials are absent. Frontend: 283 tests passed in 35 suites. Lint and production build passed.
- npm audit and pip-audit of the installed Linux runtime: zero known advisories at audit time. This is not a security certification.
- Clean source upload about **25.25 MB**; measured Linux dependencies about **240.45 MB**; combined estimate **265.70 MB** before platform wrapping. The authoritative gate is the successful cloud build, not this estimate.
- Prior audit fixes retained: patched `anyio`, `urllib3` and `brace-expansion`, and scenario losses retain their minus sign.

Numerical parity does not improve the classifier's recorded external accuracy (57.21%). See [readiness assessment](PRODUCTION_READINESS_REPORT.md).

## Reproducing an export

Install the full authoring environment using `backend/requirements-ml.txt`. Then run from the repository root:

```powershell
backend/venv/Scripts/python.exe backend/export_disease_runtime.py --photo-dir datasets/authentic/PlantDoc-export/test --reference .codex-tmp/readiness/inference-parity.npz
```

The optional reference archive is local verification data and must not be uploaded. `runtime-verification.json` records source/model/label hashes and the actual comparison scope. Changing weights or classes requires a new export and equivalent checks. The original `release.json` accuracy metrics remain unchanged.

## Safe monorepo release

The live projects are `krishyak` (root `frontend`) and `krishyak-api` (root `backend`). An older local frontend link pointed to the separate `frontend` project; the local link has been corrected. Preserve the project root settings. Running Vercel directly from `backend` with a configured `backend` root incorrectly asks for `backend/backend`.

After committing changes, `scripts/prepare_vercel_source.py backend` or `frontend` creates a fresh ignored source directory from tracked component files and copies the existing project linkage. It excludes secrets, models used only for authoring, caches, tests and training data. Deploy from that directory. Validate the linked project before upload with `vercel deploy --dry --json`.

Production configuration requires a persistent secret `SECRET_KEY`, `ENVIRONMENT=production`, `DEBUG=false`, explicit approved CORS origins, and the existing server-only provider keys. Credentials are never included in deployment source. Preview provider credentials are separate; production-target candidates allow checking the actual production configuration without changing public aliases.

```powershell
vercel deploy --prod --skip-domain --force --yes
# Check the returned candidate URL, real image inference, CORS and browser flows.
vercel promote <validated-deployment-url> --yes
```

Build both production candidates before changing aliases. Permit the specific trusted frontend candidate origin for its API checks. Verify the backend candidate, promote it, verify the new frontend against the public API, then promote the frontend. Record exact deployment IDs/URLs and request outcomes. Retain the previous deployment IDs for rollback; do not delete earlier deployments or disable deployment protection.

Live satellite imagery still requires configured CDSE credentials; weather, soil provenance, unsupported-crop and unavailable-provider states must remain truthful. Do not enable demo identity verification to make a pitch look complete.

## Release outcome

Cloud deployment URLs, final READY status and public smoke-test results are recorded after the release checks finish.
