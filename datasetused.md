# Krishyak datasets and integration status

Updated 3 October 2026. See [v2 model governance](docs/v2/MODEL_GOVERNANCE.md) and [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md) for dated evaluation results and limitations. A file present in the repository is not proof that it is used, correctly licensed, or independently validated.

## Disease images

| Collection | Provenance | Use |
|---|---|---|
| PlantVillage color images | Publisher repository: https://github.com/spMohanty/PlantVillage-Dataset ; revision `7f7ecc7e1eaca78107e3affe7cb5abd9427e139a` | Training/development with official physical-leaf grouping and duplicate checks. |
| PlantDoc | Publisher repository: https://github.com/pratikkayal/PlantDoc-Dataset ; revision `5467f6012d78d1c446145d5f582da6096f852ae8`; publisher CC-BY-4.0 | Field-like images; published test partition held out from fitting. Export manifest preserves original paths and hashes. |
| Existing `pdisease` | Original acquisition and license unverified | Explicitly labelled legacy in the combined experiment; excluded from publisher-only experiments. |

The corrected combined manifest contains 68,853 images and 77 labels before excluding labels without training support. The combined candidate has 71 classes. The selected active publisher-only EfficientNetV2B0 release has 38 classes across 14 crop categories: 94.39% validation, 93.71% internal test and 57.21% external PlantDoc accuracy. The old 42-class deployment description is historical. No model was retrained/promoted in v2 and independent farmer-field accuracy is not established. Results cannot establish superiority over NPSS.

## Active data paths

- Open-Meteo provides weather through the weather adapter. Missing required observations remain unavailable. Regional soil estimates are not measured soil readings.
- data.gov.in mandi integration requires `DATA_GOV_IN_API_KEY`. Historical CSV fallback must retain its historical source/date; it is not a live quote.
- MSP cards use synchronized `backend/data/msp_data.json` and `frontend/src/data/msp_data.json`, with individual official source links, marketing seasons, product basis and verification/effective dates. MSP/FRP is not a guaranteed sale price for every farmer; consult the record's season and effective date.
- Browser speech recognition and reverse geocoding depend on browser/provider availability. Speech support varies by device and language.
- V2 soil readings retain farmer-entered source, units, depth/date and explicit independent-verification limits. Sensor adapters require credentials and verified vendor contracts; deployed unsafe legacy sensor personal-data routes are disabled.
- Aadhaar, bank and land-record demo code does not establish real identity or eligibility. Demo verification is disabled by default.

## Existing tabular assets and assumptions

The repository contains national crop area/production/yield data, district-level CSVs, historical mandi data, spreadsheets and soil-map assets. Earlier documentation attributed these to Kaggle, ICRISAT, DES and HiHydroSoil, but complete acquisition/licensing records have not been established for every file. Preserve that distinction before redistribution or claiming authoritative regional calibration.

Yield currently uses national baselines plus explicit agronomic heuristics. Crop nutrient norms, pest thresholds and cost assumptions require independent regional validation. Cotton lint yield must not be multiplied by a seed-cotton price. Price forecasting uses persistence and supported historical volatility, not a validated optimal selling-date model.

OpenWeatherMap and SoilGrids were previously listed as active integrations without sufficient implementation evidence. They are not claimed as active data sources here. Presence of `Fertilizer Prediction.csv`, soil rasters or district files does not establish that a trained/calibrated model uses them.
