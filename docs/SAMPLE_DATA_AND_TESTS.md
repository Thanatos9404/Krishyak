# Sample data and test cases

Everything here works on a fresh clone. No farmer data is stored in this
repository: sample inputs are synthetic or come from public datasets.

## Try it without installing anything

| What | How |
|---|---|
| Demo farm with synthetic records | <https://krishyak.vercel.app/demo> (Today, Farm, Scan, Market views) |
| Farmer workspace in any language | <https://krishyak.vercel.app/app/today>, language menu at the top |
| Public API health | `curl https://krishyak.vercel.app/api/public/health` |
| Season simulator (500 runs) | `curl -X POST https://krishyak.vercel.app/api/public/simulate -H "Content-Type: application/json" --data @sample-data/simulate_wheat_jaipur.json` |

## Sample data in this repository

| File | Use |
|---|---|
| [`sample-data/simulate_wheat_jaipur.json`](../sample-data/simulate_wheat_jaipur.json) | Valid request for `POST /simulate`: 1 ha of wheat on loamy soil, Rabi, 500 Monte Carlo runs |
| [`sample-data/field_jaipur_synthetic.geojson`](../sample-data/field_jaipur_synthetic.geojson) | Synthetic field boundary near Chomu, Jaipur district, for plot and satellite tests |
| [`frontend/public/sample-crop-leaf.jpg`](../frontend/public/sample-crop-leaf.jpg) | Leaf photo for the photo check |
| [`frontend/src/data/remoteSensingDemo.json`](../frontend/src/data/remoteSensingDemo.json) | Polygon used by the satellite demo |
| [`frontend/src/data/msp_data.json`](../frontend/src/data/msp_data.json), [`governmentSchemes.json`](../frontend/src/data/governmentSchemes.json) | MSP reference cards and scheme information |
| [`backend/v2/india_locations.json`](../backend/v2/india_locations.json) | LGD snapshot: 36 states and union territories, 784 districts (hash-pinned, see `.meta.json`) |
| [`backend/v2/crop_catalog.json`](../backend/v2/crop_catalog.json) | 62 canonical crop identities with local names |
| [`backend/models/active/`](../backend/models/active/) | Active disease model (`model.tflite`, `model.keras`), class map, `release.json` with metrics and SHA-256, `runtime-verification.json` (247/247 Keras and LiteRT parity) |
| [`frontend/public/locales/workspace/`](../frontend/public/locales/workspace/) | 22 scheduled-language packs plus English |

Training images (PlantVillage, PlantDoc) are not committed; their publisher
repositories and pinned revisions are in [datasetused.md](../datasetused.md),
and release rules in [model governance](v2/MODEL_GOVERNANCE.md).
`backend/evaluation/` holds results for an older 42-class model and is kept
only for history; current metrics are in `backend/models/active/release.json`.

## Test cases

### Backend (Python 3.12)

```sh
cd backend
python -m venv venv && venv/Scripts/activate   # Windows; use venv/bin/activate on Linux or macOS
pip install -r requirements-dev.txt
python -m unittest discover
```

39 test modules (`backend/test_*.py`). A local run on 11 October 2026: 296
tests passed; 48 PostGIS integration tests skip unless `V2_TEST_DATABASE_URL`
points to a PostGIS database (CI provides one). Highlights:

| Module | What it proves |
|---|---|
| `test_inference_contracts.py`, `test_litert_runtime.py`, `test_prediction_metadata.py` | Abstention below 0.75 and on crop mismatch, LiteRT parity, model provenance in every result |
| `test_passkeys.py`, `test_security_contracts.py`, `test_v2_foundation.py` | Passkey sign-in, recovery codes, sessions, CSRF, consent, export and deletion |
| `test_remote_sensing*.py` | Cloud mask gates, MAD trend rule, provider failures, place lookup |
| `test_market_prices.py`, `test_mandi_contracts.py` | Same-series mandi trends, stale data labelling |
| `test_usage_controls.py`, `test_rate_limiter.py` | Provider budgets fail closed |
| `test_scenario_contracts.py`, `test_simulation_context.py` | Simulator input bounds and reproducibility |
| `test_india_locations.py`, `test_crop_catalog.py` | LGD snapshot integrity, crop identities |

### Frontend (Node 22.13+)

```sh
cd frontend
npm ci
npm test            # Jest: 53 suites, 345 tests passed on 11 October 2026
npm run build
npm run test:e2e    # Playwright: Chromium, Firefox, WebKit, Pixel 7, with Axe checks
```

### Continuous integration

`.github/workflows/v2-quality.yml` runs on every pull request: Ruff, Bandit,
pip-audit, Alembic migrations up, down and up with `alembic check`, backend
tests on disposable PostGIS and Redis, Jest, Prettier, ESLint, npm audit,
browser tests on three engines with Axe, a public crawl and an offline
classifier container smoke.

### Live smoke against a deployment

```sh
python scripts/smoke_staging.py --api https://krishyak-api.vercel.app --origin https://krishyak.vercel.app --secrets <ignored-secrets-file>
```
