# Krishyak — presentation and technical defence guide

**Repository snapshot reviewed: 23 September 2026. Presentation: 24 September 2026.**

This guide describes the code and saved experiment evidence currently in this repository. “Implemented” means code exists and the stated checks passed; it does not mean the feature has been validated on farms or deployed successfully at national scale. Equations describe the implementation, not an endorsement of its agronomic accuracy. Configuration tables in the appendices were extracted from source to avoid inventing coefficients.

## 1. What to say first

> Krishyak is a farmer-facing decision-support prototype that combines crop-image classification, explainable cultivation economics, scenario comparison, weather information, soil and fertilizer workflows, and market information. It helps a farmer examine how changing farm inputs could change estimated yield, cost, profit and risk. We distinguish measured data from assumptions and are developing stronger field validation before making production accuracy claims.

The central problem is that identifying a crop problem is only one part of a farming decision. A farmer also needs to understand the cost of an intervention, the assumptions behind an estimate, and the possible financial consequences. Krishyak brings these activities into one interface.

**The defensible USP:** accessible, explainable farm scenario planning alongside crop-health assistance, with visible uncertainty and data provenance. This is a product positioning argument, not proof that no competitor has similar capabilities.

### The five facts to memorize

1. Yield, cultivation cost, risk and fertilizer engines are mainly **rules and arithmetic**, not trained predictive ML models.
2. Image disease classification is the principal implemented learned model.
3. The latest 38-class EfficientNetV2B0 candidate achieved **94.39% validation, 93.71% internal test and 57.21% external PlantDoc test accuracy**. These are different datasets and must be reported separately.
4. That candidate **has not been promoted to the default production model**. The default path still points to the older 42-class MobileNetV2 artifact unless an explicit bundle override is configured.
5. We have **not demonstrated superiority over NPSS**, 94% field accuracy, measured farmer income improvement, or nationally validated agronomic recommendations.

## 2. Implemented scope and boundaries

| Area | What exists | What must not be implied |
|---|---|---|
| Farm input and registration | Forms, validation, farmer-session handling, local storage workflows | A verified national farmer identity registry |
| Yield estimation | National/static baseline multiplied by six agronomic modifiers | A locally trained yield model or a measured yield-accuracy percentage |
| Cost and profit | Itemized cultivation costs, revenue, profit and ROI | Guaranteed income or a complete accounting model |
| Scenario comparison | Current plan, rule-generated alternative, stressed scenario | Globally optimal farming plan or mathematically worst outcome |
| Sensitivity analysis | Repeated calculations under sampled assumptions | A calibrated probability of profit |
| Crop health | Image upload, model inference, class mapping, crop mismatch/uncertainty handling | Universal plant diagnosis, lesion segmentation or laboratory confirmation |
| Fertilizer | Crop/stage recipes, nutrient accounting, chemical and organic suggestions | Soil-test-calibrated fertilizer prescription |
| Weather | Current/forecast retrieval and threshold-based alerts | Locally trained weather prediction or guaranteed forecast availability |
| Pest intelligence | Weather/season suitability rules, report and alert interfaces | Verified national outbreak surveillance or calibrated outbreak probability |
| Soil | Manual entries, vendor adapter interfaces, cached readings/history | A physical sensor supplied by the app or verified vendor partnerships |
| Market prices | Mandi/MSP information with source/freshness handling | Every displayed figure is live or a guaranteed selling price |
| Price forecast | Entered-price persistence baseline; conditional uncertainty interval | A validated price forecast or optimal selling date |
| Government schemes/JAM | Information and consent/demo integration scaffolding | Official Aadhaar, bank, land or benefit verification |
| Language and voice | 23 locale codes, translations and browser speech interfaces | Equally complete translations or working speech for every language/device |
| Offline resilience | Cached observations/results with expiry and request binding | Fully offline image inference or a fully offline installable application |

The crop dropdown, soil matrix, pest knowledge base and classifier labels have **different coverage**. Adding a crop to a dropdown does not train a disease model for that crop. Some crop names are aliases, so dropdown entries are not necessarily distinct biological species.

## 3. Architecture and data flow

```text
Farmer / browser
  -> React interface: inputs, location, images, language, results
  -> API client: request validation, errors, cache/request coordination
  -> FastAPI backend
       -> SimulationEngine
            -> DataLoader -> national yield CSV / historical price CSV / static fallback
            -> YieldEstimator
            -> CostCalculator
            -> PriceForecaster
            -> RiskEngine
            -> current / alternative / stress / Monte Carlo results
       -> model_inference -> TensorFlow/Keras model + exact class-index mapping
       -> fertilizer_analyzer -> crop-stage nutrient recipes
       -> weather_alerts -> external weather service + threshold rules
       -> mandi / government API services -> data sources + freshness metadata
       -> sensor_adapter / soil cache -> observed or manually entered soil data
       -> pest intelligence / report storage
       -> registration and consent/demo identity services
  <- Structured results and evidence metadata
  <- Charts, cards, explanatory breakdowns and uncertainty messages
```

### Technology choices

| Technology | Role and rationale | Constraint |
|---|---|---|
| React 18 | Component-based UI, reusable forms/cards and reactive scenario views | Browser resources and accessibility still require testing |
| Vite 8 | Development server and production bundling | Requires compatible Node; package declares `^22.13.0 || >=24` |
| Tailwind CSS | Consistent utility-based styling | Styling does not establish usability with farmers |
| Recharts/Chart.js | Scenario and time-series visualization | Charts must label assumed versus observed data |
| Axios | API communication | Network/server failures remain possible |
| FastAPI/Pydantic | Typed request contracts, input bounds and structured responses | Validation only establishes allowed values, not agronomic realism |
| NumPy/Pandas | Numeric calculations and CSV processing | Dataset quality and units determine usefulness |
| TensorFlow/Keras | Image classifier training and inference | Model startup, memory and deployment dependencies need suitable hosting |
| JSON/CSV/file caches | Lightweight prototype persistence | Not a production multi-instance database |
| Jest and Python unittest | Regression/contract checks | Tests cannot replace field validation |

`hybrid_inference.py` currently adds truthful metadata to existing outputs. Its name does **not** mean XGBoost, an LLM, a model ensemble or a trained yield/price model is running. It explicitly states that no independently validated yield/price ML artifact is installed.

## 4. Units and notation

| Symbol | Meaning | Unit |
|---|---|---|
| A | Cultivated area | hectare |
| Y0 | Baseline yield | kg/ha |
| Y | Estimated yield density | kg/ha |
| Qkg, Qq | Total production | kg, quintal respectively |
| R | Expected rainfall supplied to simulation | mm |
| d | Rainfall delay | days |
| f | Irrigation frequency | events/month |
| m | Season duration for irrigation costing | months |
| q | Seed quality input | dimensionless, 0–1 |
| p | Pest likelihood input | dimensionless, 0–1; not automatically a calibrated probability |
| i | Pest-control intensity | dimensionless, 0–1 |
| P | Selling price | INR/quintal |
| N, P2O5, K2O | Fertilizer nutrient accounting basis | kg/ha |

One quintal is 100 kg. Fertilizer mix quantities are **kg per hectare**. Seed quantity and labour days in the costing interface are **whole-farm totals**. This distinction prevents multiplying the same input by area twice. Soil measurements and fertilizer label percentages must use compatible chemical and measurement bases before subtraction.

## 5. Yield engine: all active equations

Source: [yield_estimator.py](backend/yield_estimator.py), [data_loader.py](backend/data_loader.py), [config.py](backend/config.py).

### 5.1 Main model

```text
Y = Y0 × Msoil × Mrain × Mirrigation × Mfertilizer × Mseed × Mpest
Qkg = Y × A
Qq = Qkg / 100
```

**Why this form:** each modifier represents a relative adjustment to a baseline, making the contribution of each input inspectable. Multiplication allows several stresses to compound.

**What is not established:** the coefficients were not fitted to local farm outcomes. Multiplication assumes a simplified structure for interacting effects. Rain, irrigation, soil and pests interact in reality, so independent modifiers can double-count effects or miss interactions. No validated yield MAE/RMSE is available.

### 5.2 Baseline selection

The loader reads `datasets/All-India_-Crop-wise-Area,-Production-&-Yield.csv`. It matches crop and season (normally `Total`), checks the most recent `Yield-*` columns first and returns the first positive finite value from the matching row. Aliases include Chickpea→Gram, Arhar→Tur and Sesame→Sesamum. Returned metadata includes source, record year, units and region.

If no usable record exists, the engine uses `DEFAULT_YIELDS`, or 2,000 kg/ha for an unknown crop. This is a national/static starting point, **not a district/farm prediction**. Cotton baseline metadata identifies lint; sale-price and production-product basis must match before interpreting cotton economics. Seed cotton and lint are not interchangeable products.

### 5.3 Soil modifier

`Msoil` is a crop/soil lookup value. The complete matrix is in Appendix A. Example: Rice/Alluvial is 0.95. This means a 5% reduction relative to the selected baseline within this heuristic; it is not a measured 95% suitability probability.

Missing crop/soil combinations use: Alluvial 0.80, Black 0.75, Red 0.70, Laterite 0.60, Desert 0.40, Mountain 0.60, Clay 0.75, Sandy 0.50; anything else 0.70. This includes Loamy when no explicit crop entry exists.

**Constraint:** broad soil names do not describe nutrient availability, salinity, depth, drainage or within-field variability. The matrix needs agronomic review and localization.

### 5.4 Rainfall and delay

| Crop | Lower optimum L | Upper optimum U |
|---|---:|---:|
| Rice | 1,000 | 1,500 |
| Wheat | 400 | 600 |
| Maize | 600 | 900 |
| Cotton | 600 | 1,000 |
| Sugarcane | 1,200 | 1,800 |
| Other crops | 500 | 800 |

```text
RainFit(R) = 1                                      if L ≤ R ≤ U
           = max(0.4, 1 − 0.6 × (L − R)/L)         if R < L
           = max(0.5, 1 − 0.4 × (R − U)/U)         if R > U
DelayFit(d) = max(0.6, 1 − 0.015 × max(0, d))
Mrain = RainFit × DelayFit
```

The intended rationale is to penalize inadequate/excess rain and delayed rain, with floors preventing the estimate from collapsing solely because of one input. **Those slopes, ranges and floors are assumptions**, not learned dose-response curves. Seasonal rainfall totals omit distribution, runoff, growth stage and waterlogging duration. Weather-alert rainfall uses short forecast windows; it is not automatically equivalent to this simulation input.

### 5.5 Irrigation

```text
If R > 800:
  Mirrigation = min(1.3, 1 + 0.01f)
Otherwise:
  Mirrigation = min(1.3, 1 + 0.03f × (1 + max(0, (800 − R)/800)))
```

This assumes irrigation helps more when rainfall is low and caps the benefit at 30%. It does not model water volume, irrigation efficiency, soil moisture balance, pump capacity or over-irrigation damage. Frequency alone is an incomplete agronomic variable.

### 5.6 Fertilizer response

For fertilizer quantities `xj` and nutrient fractions `nj,pj,kj`:

```text
Napplied = Σ xj nj;  Papplied = Σ xj pj;  Kapplied = Σ xj kj
score(applied, target) = max(0, 1 − |applied − target| / target)
S = (scoreN + scoreP + scoreK)/3
Mfertilizer = 0.7 + 0.5S
```

An empty fertilizer mix returns 0.70. A perfectly matching mix returns 1.20. Excess as well as shortage lowers the score.

| Yield-engine target | N | P | K |
|---|---:|---:|---:|
| Rice | 80 | 40 | 40 |
| Wheat | 120 | 60 | 40 |
| Maize | 100 | 50 | 50 |
| Cotton | 100 | 50 | 50 |
| Default | 80 | 40 | 40 |

**Important inconsistency:** these targets differ from the separate fertilizer-advisory engine, for example Rice 80/40/40 here versus 120/60/60 there. The systems are not one calibrated nutrient-response model. Do not defend both as a single scientifically validated prescription. Reconciliation is a priority.

### 5.7 Seed and pest effects

```text
Mseed = 0.6 + 0.5q
Mpest = 1 − 0.4p
```

Seed quality ranges from a 0.6 to 1.1 multiplier. Maximum pest input reduces yield by 40%. These are controllable scenario assumptions; the image classifier does not measure this loss coefficient or automatically estimate field pest incidence.

### 5.8 Yield “confidence” field

```text
C = clip(((q + Msoil + Mrain)/3) × (1 − 0.3p), 0.4, 0.95)
```

The response labels this `uncalibrated_input_suitability_score`. It is a heuristic score based on favorable inputs, **not the chance that the yield prediction is correct**, not a confidence interval and not model accuracy. The 0.95 cap is a chosen constant, not evidence of 95% performance.

## 6. Cultivation cost, revenue and profit

Source: [cost_calculator.py](backend/cost_calculator.py), [simulation_engine.py](backend/simulation_engine.py).

```text
Cseed = total seed kg × crop seed price per kg
Cfert = A × Σ(fertilizer kg/ha × fertilizer INR/kg)
Cirrigation = f × m × 50 × A × 15 × rain_discount
  rain_discount = 0.7 if R > 800, otherwise 1
Clabour = total person-days × 400
Cpesticide = 2500 × A × (0.5 + i)
Clandprep = 3500 × A
Charvest = 4000 × A
Direct = Cseed + Cfert + Cirrigation + Clabour + Cpesticide + Clandprep + Charvest
Miscellaneous = 0.10 × Direct
MarketFee = 0.025 × Qq × P
Logistics = 50 × Qq
TotalCost = 1.10 × Direct + MarketFee + Logistics
Revenue = Qq × P
Profit = Revenue − TotalCost
ROI_percent = 100 × Profit / TotalCost
CostPerHectare = TotalCost / A
CostPerQuintal = TotalCost / Qq
```

The irrigation calculation assumes 50 mm per event and INR 15 per mm per hectare. It is not a metered water or electricity bill. `season_months` makes frequency-based costs cover the season rather than just one month.

**Why arithmetic rather than ML:** once quantities and unit prices are specified, multiplication and addition are transparent and auditable. ML is unnecessary for basic accounting. Predicting unknown prices or labour requirements would be a separate forecasting task requiring data.

**Constraints:** fixed prices may be outdated or geographically inappropriate. The engine does not comprehensively account for land rent, finance costs, depreciation, insurance, storage, spoilage, quality grades, harvest timing or household labour opportunity cost. “Profit” means the model's revenue minus its included costs. Zero production returns cost/quintal as 0 in code, although the mathematical quantity is undefined; do not interpret that as free production. Zero cost similarly uses a zero ROI guard.

When seed quantity is omitted, simulation supplies 50 kg/ha × area. This generic assumption is particularly unsuitable for crops established through seedlings, cuttings or planting material. Use explicit crop-appropriate inputs in a demonstration.

## 7. Risk engine

Source: [risk_engine.py](backend/risk_engine.py).

```text
Risk = min(100,
           0.30 × WeatherRisk
         + 0.25 × PriceRisk
         + 0.25 × PestRisk
         + 0.20 × SoilRisk
         + 10 × (1 − C))
```

The four main weights sum to 1. Weather receives the largest share; price and pest are tied; soil receives 20%. This is the current design choice. **There is no training evidence that 0.30/0.25/0.25/0.20 are optimal.** The final uncertainty penalty is added separately and can contribute up to 6 points under the yield score's 0.4 floor.

### Component equations

```text
WeatherRisk = clip(20 + 80 × (1 − Mrain), 0, 100)
PestRisk = 100p
SoilRisk = 100 × (1 − crop_soil_compatibility)
PriceCV = population_std(daily median prices) / mean(daily median prices)
```

| Price coefficient of variation | Price risk |
|---|---:|
| <0.15 | 20 |
| 0.15 to <0.25 | 40 |
| 0.25 to <0.35 | 60 |
| ≥0.35 | 80 |

Usable historical evidence needs at least two observations and a finite nonnegative volatility. Otherwise the engine uses an explicitly assumed CV of 0.25, giving risk 60. Missing data does not imply zero risk. For unsupported soil entries the risk engine defaults to compatibility 0.70; this is not identical to every yield fallback.

The no-crop weather fallback uses rainfall bands: 600–1,200→20; 400–600 or 1,200–1,500→40; 200–400 or 1,500–2,000→60; otherwise 80, then adds `min(40, 2d)` and caps at 100. The normal simulation supplies a crop and uses its rainfall modifier instead.

| Final score | Label |
|---|---|
| ≤25 | Low |
| >25 to ≤50 | Moderate |
| >50 to ≤75 | High |
| >75 | Severe |

**Interpretation:** a comparative heuristic index, not probability of crop failure. Several components reuse yield inputs, so the composite is not a set of independent measurements. Field outcomes and agronomist review are needed to calibrate weights and category thresholds.

## 8. Scenario engine and Monte Carlo

### 8.1 Three scenarios

| Scenario | Construction |
|---|---|
| Current | Inputs entered by the farmer |
| Alternative (`ai_optimal_plan` internally) | Rule-based changes described below |
| Stress (`worst_case` internally) | Fixed unfavorable perturbations described below |

The alternative keeps seed quality unchanged. If rainfall is below 600 mm it adds two irrigation events per month. Rice uses Urea/DAP/MOP 150/80/60 kg/ha; Wheat 180/100/60; Maize 160/90/70. Pest-control intensity increases by 0.3 capped at 1; pest input decreases by 0.15 floored at 0. Selling month is retained. If calculated profit is lower than the current plan, the current result replaces the alternative.

**Why useful:** a concrete comparison is easier to inspect than an unexplained recommendation. **Why not an optimizer:** the code does not search all feasible actions, solve constraints, or prove optimality. Assumed treatment benefit is not a causal estimate from trials. Rejecting lower-profit alternatives also does not prove lower risk.

The stress case uses:

```text
seed quality = max(0, q − 0.4)
rainfall = 0.5R; rainfall delay = d + 30
irrigation frequency = f + 2; fertilizer unchanged
pest input = min(1, p + 0.4)
control intensity = max(0, i − 0.45)
sale price = 0.8P; selling month = 0; labour = 1.5 × current labour
```

This is a named stress scenario, not a guaranteed lower bound. Halving excessive rainfall could improve the rainfall modifier. Generated scenarios also deserve independent agronomic feasibility checks.

### 8.2 Sampling equations

Default sample count is 500; the simulation endpoint accepts 100–2,000. The recommendation endpoint uses 300. A local generator seeded with 42 makes repeated same-input runs reproducible.

```text
Rj = R × Uniform(0.8, 1.2)
pj = clip(p + Uniform(−0.15, 0.15), 0, 1)
fertilizer_mix_j = fertilizer_mix × Uniform(0.85, 1.15)
Pj = P × Uniform(0.9, 1.1)
profit_j = scenario_calculator(Rj, pj, fertilizer_mix_j, Pj, other unchanged inputs)

mean_profit = Σ profit_j / N
population_sd = sqrt(Σ(profit_j − mean_profit)^2 / N)
profitable_share_percent = 100 × count(profit_j > 0)/N
```

Minimum, maximum and 25th/75th percentiles are also reported. A single sampled multiplier scales the whole fertilizer mix within a trial. Rounded scenario results enter the summary statistics. Baseline yield and price context are captured once and reused across scenarios in a request.

**Why Monte Carlo:** it propagates specified uncertainty ranges through a nonlinear calculator and reveals sensitivity. **Limitations:** uniform ranges are assumed; rainfall, pests and market price are not modeled jointly; no calibrated probability distribution exists. The output field `probability_of_profit` is a share of these assumed samples, not an observed chance of profit. The configuration contains a temperature variance, but this simulation path does not actually perturb temperature.

## 9. Price engine and market information

Source: [price_forecaster.py](backend/price_forecaster.py), [mandi_adapter.py](backend/mandi_adapter.py), [gov_api_service.py](backend/gov_api_service.py).

### Persistence forecast

```text
ForecastPrice(t) = P0 × exp(0 × t) = P0
r_t = ln(P_t / P_(t−1))
sigma = sample_standard_deviation(valid consecutive daily log returns)
Lower(t) = P0 × exp(−1.96 × sigma × sqrt(t))
Upper(t) = P0 × exp(+1.96 × sigma × sqrt(t))
```

The central forecast is flat because no validated directional model is installed. The default anchor is the user-entered price. A live-market anchor requires an explicit option and valid fresh live data; normal scenario calculation uses the entered-price baseline.

Historical data are reduced to daily median modal prices, avoiding the false interpretation of multiple markets on one date as many days. Only consecutive calendar-day returns are used. At least 20 valid returns are needed for the interval. Volatility labels are High above 0.025, Moderate above 0.015, otherwise Low; unavailable evidence yields unknown rather than a fabricated estimate.

**Interval limitations:** 1.96 is a conventional normal approximation multiplier, but this model has not demonstrated 95% future coverage. Aggregated markets, missing dates, seasonality, price controls, commodity grades and shocks violate simple assumptions. The risk engine's price CV and this engine's daily log-return sigma are different statistics.

The response sets `timing_supported: false`. A compatibility field containing day 0 is not evidence that today is the best selling day. Selling month maps to approximately 30 days per month, but the flat baseline cannot justify a timing recommendation. API horizon is 1–180 days; internal validation allows up to 366.

MSP is a policy reference, not a guarantee of procurement or the price at the nearest mandi. Live prices, cached records, historical CSVs, static MSP data and user-entered prices must remain visibly distinct. There are duplicated/legacy MSP constants in the repository; use the dated active dataset and source metadata, not a constant named `MSP_RATES_2025` as a current quote. Never compare lint yield against seed-cotton price without conversion evidence.

## 10. Fertilizer advisory engine

Source: [fertilizer_analyzer.py](backend/fertilizer_analyzer.py). Exact crop requirements and stage fractions are in Appendix B.

### Crop-stage requirements

```text
StageN = SeasonalN × stage_N_fraction
StageP = SeasonalP × stage_P_fraction
StageK = SeasonalK × stage_K_fraction
```

Rice seasonal requirements in this module are 120/60/60; Wheat 120/60/40; Maize 150/75/60 kg/ha. The default is 100/50/50. Different stages allocate different shares: for example Rice N is split into four quarters; P is basal; K is split 0.5 basal, 0.25 late vegetative and 0.25 flowering.

### Nutrient-gap display

```text
GapN = max(0, required_N − measured_N)
GapP = max(0, required_P − measured_P)
GapK = max(0, required_K − measured_K)
```

These subtractions are meaningful only when units and nutrient basis match. P/K comparisons are not treated as known unless the input declares the compatible `N_P2O5_K2O` basis. Missing measurements remain unknown. A gap greater than 30% of requirement is labeled deficient in this logic.

**Crucial detail:** the chemical recipe is calculated from crop-stage requirements, **not a calibrated soil-test nutrient balance**. The response describes it as `generic_crop_stage_recipe_not_soil_test_calibrated`. Showing a nutrient gap does not mean the prescription has accounted for availability, soil extraction method or fertilizer recovery efficiency.

### Chemical recipe

```text
DAP_kg_per_ha = min(StageP/0.46, 150, max(0, StageN)/0.18)
remainingP = StageP − 0.46 × DAP
remainingN = StageN − 0.18 × DAP
SSP_kg_per_ha = remainingP / 0.16
Urea_kg_per_ha = remainingN / 0.46
MOP_kg_per_ha = StageK / 0.60
TotalFarmDose = DosePerHectare × A
DoseCost = TotalFarmDose × configured_price_per_kg
```

The DAP cap based on N prevents supplying more nitrogen through DAP than the stage calls for. SSP supplies remaining P; Urea remaining N; MOP K. This is a sequential recipe, **not least-cost linear programming**. Prices are configured estimates.

Organic basal suggestions include vermicompost 5,000 kg/ha and neem cake 200 kg/ha. Their nutrient percentages represent total material content, not immediate plant availability. The integrated nutrient management helper describes half chemical requirements plus fixed organic quantities (vermicpost 2,500 and neem cake 100 kg/ha). Its “50% organic + 50% chemical” wording is a recipe description, not a verified nutrient-equivalence or savings result. The chemical half-dose equations are `0.5N/0.46`, `0.5P/0.16`, `0.5K/0.60` for Urea, SSP and MOP respectively.

**Agronomic constraints:** soil test methodology, pH, micronutrients, prior crop, manure mineralization, irrigation, cultivar and local extension guidance are not fully modeled. Do not present embedded safety/treatment text as an independently reviewed prescription.

## 11. Weather, pest and soil engines

### 11.1 Weather alerts

Weather data retrieval uses Open-Meteo in the weather-alert service. The application derives alerts from thresholds; it does not run its own atmospheric model. It checks current conditions and short-range forecasts, validates usable time windows, and can return unavailable data.

Alert rules include:

- Temperature below crop minimum: cold/frost advisory; warning below minimum minus 5°C.
- Temperature above maximum: heat advisory; warning above maximum plus 5°C.
- Maximum next-day hourly precipitation probability above 70%: rain notice; if next-24-hour rainfall exceeds 50 mm, heavy-rain warning.
- Wind above spray threshold: avoid spraying advisory.
- Humidity above upper threshold: high-humidity advisory.
- Irrigation suggestion requires available forecast, maximum rain probability below 30%, and humidity below minimum.

**Known code issue found while preparing this guide:** the threshold dictionary uses crop keys such as `Rice`, but the lookup uses `crop.lower()`. Those crop names therefore fall back to the default thresholds in this path. The current default is 10–40°C, 40–90% humidity, 12 km/h spray wind limit. Appendix C contains the configured crop values, but do not claim they are being selected correctly. This documentation task records the issue; it does not silently change the application.

The seven-day summary adds forecast rainfall and groups hourly values by day. A displayed maximum hourly rain probability is not a calculated joint probability of rain at any time that day. Rain summaries use totals below 10, 50 and 100 mm as category boundaries. Some configured fields such as drought days and optimal monthly rain are not used by the active alert equations.

### 11.2 Pest suitability

Source: [pest_intelligence.py](backend/pest_intelligence.py).

```text
TemperatureFit = 0.8 inside pest's configured temperature range
               = max(0, 0.8 − 0.1 × distance outside range) otherwise
HumidityFit = min(1, 0.5 + 0.01 × (H − Hmin))    if H ≥ Hmin
            = max(0, 0.5 − 0.02 × (Hmin − H))    otherwise
WeatherFit = min(1, 0.6 × TemperatureFit + 0.4 × HumidityFit)
SeasonFit = 0.8 in peak months, 0.5 in cyclic adjacent months, 0.3 otherwise
RainFit = 0.3 normally
        = 0.7 if rainfall > 50 and pest humidity minimum > 70
        = 0.4 if rainfall > 50 and the preceding humidity condition does not hold
Suitability = (0.35 × SeasonFit + 0.30 × WeatherFit + 0.15 × RainFit) / 0.80
```

The denominator renormalizes the available components; no invented geographic score is added. Unknown pest/crop weather matching returns a fallback score of 0.3. Suitability at least 0.7 is High; at least 0.5 is Medium; otherwise Low. Advisories have a three-day validity period, but that is not evidence of a validated three-day outbreak forecast.

Location risk explicitly lacks verified regional observations. Government alerts and historical outbreaks are unavailable when there are no records. Farmer-submitted reports are a separate evidence source and are not automatically government-confirmed outbreaks. Confidence is not supplied as a calibrated probability. Old hotspot dictionaries or helper names are not proof of a live surveillance feed.

### 11.3 Soil and sensors

Sensor adapter interfaces exist for Fasal, CropIn, SoilMatic and manual input. This is code-level integration scaffolding, not proof that a real customer device or vendor API has been connected. Readings include N/P/K, pH, moisture, temperature and optional organic carbon/electrical conductivity.

Numeric validation rejects nonfinite or out-of-range values. Readings retain source and timestamp. File-based cache uses device identity checks, hashed filenames and atomic replacement. History retention is 30 days; the stale threshold is 24 hours. These controls protect consistency but do not establish sensor calibration or secure multi-tenant authorization.

Manual entries remain manual observations. A cached reading is not a new measurement. Moisture percentage alone is not plant-available water without soil-specific calibration.

## 12. Disease model: architecture, training and honest results

### 12.1 Default inference model versus research candidate

| Attribute | Default installed artifact | Latest evaluated candidate |
|---|---|---|
| Path | `backend/models/plant_disease_model.h5` | `backend/training_runs/publisher-efficientnet-colab-v1/model.keras` |
| Backbone | MobileNetV2 | EfficientNetV2B0 |
| Classes | 42 | 38 |
| Deployment status | Default loader path, subject to runtime dependencies | Not promoted |
| Main evidence limitation | Older artifact and different evaluation split | Large external-domain performance gap |

`KRISHYAK_DISEASE_BUNDLE` can override the model and class file together. A saved experiment does not automatically become the served model. The exact classes for both artifacts are in Appendix D.

The older artifact's post-hoc evaluation on 3,173 validation images was about **78.10% top-1**, **90.95% top-3**, **65.10% balanced accuracy**, **59.79% macro-F1**. It is not a like-for-like comparison with the new 38-class candidate because labels and partitions differ. Do not advertise the new candidate's score as the default model's measured score.

### 12.2 Candidate architecture and preprocessing

```text
Image -> EXIF orientation correction -> RGB / transparency on white
      -> PIL resize to 224 × 224 -> float pixels / 255
      -> embedded rescale: 2x − 1
      -> ImageNet-pretrained EfficientNetV2B0, without original classifier
      -> global average pooled features
      -> Dense(256, ReLU) -> Dropout(0.3)
      -> Dense(38, softmax)
```

The frozen-backbone stage trained the new classification head. Fine-tuning then unfroze the last 35 backbone layers while keeping batch-normalization layers frozen. This retains general visual features while adapting part of the network to crop images. It is transfer learning, not training an entire image model from scratch.

The old MobileNet artifact has a different head: global average pooling, batch normalization, Dense 512/ReLU, dropout 0.5, batch normalization, Dense 256/ReLU, dropout 0.3, and 42-way softmax.

**Why these choices are reasonable:** compact pretrained CNNs provide reusable visual features and make training practical on limited compute. A smaller head limits newly trained parameters. Dropout discourages dependence on individual features; frozen batch normalization avoids changing those statistics during small-batch fine-tuning. These are engineering rationales, not evidence that these architectures outperform every alternative for Indian farms.

### 12.3 Learning equations and weights

```text
softmax(z)_k = exp(z_k) / Σ_j exp(z_j)
predicted class = argmax_k softmax(z)_k
cross_entropy_i = −log(probability assigned to true class_i)
weighted_loss = average_i(weight_i × cross_entropy_i)
```

For the frozen head, class weight is:

```text
w_c = clip(sqrt(mean_training_class_count / training_count_c), 0.25, 4.0)
```

This reduces majority-class dominance without the full inverse-frequency penalty. The frozen trainer also supports domain balancing; do not assume every optional mode was enabled without that run's metadata.

The fine-tuning data pipeline uses domain weights proportional to `priority[source]/source_count`, normalized to mean 1. Priorities in code are PlantVillage 0.4, PlantDoc 0.4 and legacy-unverified 0.2. **The latest publisher-only manifest contains no legacy-unverified training images**, so that third entry contributes nothing. The retained two domains receive equal total loss weight after normalization, although PlantDoc has far fewer images. This changes contribution to the loss; it does not create additional independent field images.

Neural-network “weights” also means millions of learned tensor values. Their exact values are in the model artifact, not a hand-selected list of meaningful agronomic coefficients. The SHA-256 below identifies the exact evaluated artifact. Do not claim a single CNN weight means “30% rainfall.”

| Training item | Frozen head / latest fine-tune |
|---|---|
| Optimizer | Adam |
| Frozen-head learning rate | 0.0003 |
| Fine-tune learning rate | 0.00001 |
| Fine-tune seed | 43 |
| Fine-tune batch | 32 |
| Steps per epoch | 1,000; repeated shuffled training stream |
| Requested / completed epochs | 12 / 11 |
| Fine-tune augmentation | Horizontal flip, rotation factor 0.08, contrast factor 0.15 |
| Fine-tune early stop | 3 unimproved validation-loss epochs |
| Selected checkpoint | Epoch 8 (zero-based epoch 7), best validation loss 0.6998786926 |
| Model selection | Validation loss; test partitions used for subsequent evaluation |

For reference, Adam maintains moving averages of gradient and squared gradient, bias-corrects them, then updates parameters approximately as `theta <- theta − learning_rate × m_hat/(sqrt(v_hat)+epsilon)`. The code uses framework defaults for Adam settings it does not explicitly override. The learning-rate number is an update scale, not accuracy.

### 12.4 Authentic data and splitting

The publisher-only manifest retains **56,833 images, 38 classes and 14 crop categories** from PlantVillage and PlantDoc. It preserves grouped partitions and excludes legacy-source images. Exact publisher revisions are in Appendix E.

| Split | PlantVillage | PlantDoc | Total | Use |
|---|---:|---:|---:|---|
| Train | 40,354 | 1,756 | 42,110 | Update model parameters |
| Validation | 5,172 | 244 | 5,416 | Select checkpoint |
| Internal test | 8,261 | 305 | 8,566 | Same collection-family evaluation |
| External test | 0 | 229 | 229 | Reserved published PlantDoc test |
| Legacy-validation overlap reserve | 497 | 15 | 512 | Groups matching old validation pixels, excluded from training/selection |

The audit records 6,440 removed duplicates, five corrupt images and 91 conflicting images quarantined in its preparation history. Grouping uses leaf IDs and exact perceptual hashes across sources. Exact perceptual hashing cannot remove every near duplicate or identify every hidden farm/session relationship. The 512-image reserve is not an independent Indian field benchmark and should not be promoted as the headline result.

PlantVillage contributes controlled/background-constrained leaf images; PlantDoc introduces more varied field-like imagery. The latter is useful but its 229-image held-out partition is small and not a representative Indian deployment study. Because related candidate experiments have already been compared on these tests, a new untouched prospective benchmark is needed for a final performance claim.

### 12.5 Results that can be shown

| Partition | Correct / total | Top-1 accuracy | Wilson 95% interval |
|---|---:|---:|---:|
| Validation | 5,112 / 5,416 | 94.3870% | 93.7419–94.9691% |
| Internal test | 8,027 / 8,566 | 93.7077% | 93.1736–94.2026% |
| External PlantDoc test | 131 / 229 | 57.2052% | 50.7299–63.4428% |

Internal balanced accuracy is approximately 91.52% and macro-F1 91.55%. External balanced accuracy is approximately 57.58% and macro-F1 56.83%. Per-class results are included in Appendix D because overall accuracy can hide weak classes.

The frozen EfficientNet parent scored 93.2174% internal and 54.5852% external. Fine-tuning increased correct external predictions by six net images: 12 gained, six lost. The saved paired exact comparison reports p≈0.238 for that external change, so this is not convincing evidence of a reliable external improvement. Internal comparison reports p≈0.014, but repeated experimentation and domain limitations still matter.

The release gate requires the lower Wilson 95% bound to exceed 94% on **both** internal and external tests. The candidate fails this gate. Validation above 94% does not satisfy it.

### 12.6 Evaluation equations

```text
Accuracy = number correct / number evaluated
Precision_c = TP_c / (TP_c + FP_c)
Recall_c = TP_c / (TP_c + FN_c)
F1_c = 2 × Precision_c × Recall_c / (Precision_c + Recall_c)
MacroF1 = unweighted mean of class F1 values
BalancedAccuracy = unweighted mean of recall across evaluated supported classes
```

For `n` observations, accuracy `p_hat`, and `z=1.96`, Wilson interval is:

```text
denominator = 1 + z²/n
center = (p_hat + z²/(2n))/denominator
halfwidth = z × sqrt(p_hat(1−p_hat)/n + z²/(4n²))/denominator
interval = [center − halfwidth, center + halfwidth]
```

The interval reflects sampling uncertainty under its assumptions. It does not fix label noise, dataset bias, farm clustering, duplicate leakage or distribution shift.

### 12.7 Runtime safeguards and limitations

The loader checks model input/output compatibility and class-index mapping. Inference checks probability dimensions, finite values and valid ranges. Image decoding handles orientation and transparency. Low confidence below 0.75, unsupported selected crops and crop mismatch produce uncertain/unsupported handling. Missing models/dependencies are reported rather than replaced by invented predictions.

The 0.75 threshold is a policy setting, **not a calibrated 75% diagnostic reliability guarantee**. Softmax is a relative score over known labels. A model can be confidently wrong on a new crop, nutrient deficiency, blur, background or unseen disease. One image can contain multiple problems while this model predicts one label. There is no validated lesion-area severity model. “Healthy” means the classifier's healthy class, not proof that a plant has no disease.

The crop-health output is not a validated causal input into the yield-loss model. The app combines workflows; it does not yet establish a scientifically validated image→severity→yield-loss→treatment-benefit chain.

### 12.8 Dataset expansion currently in progress

Makerere Beans publisher data have been downloaded at a pinned revision. The task concerns angular leaf spot, bean rust and healthy beans. Data acquisition is not completed model integration: it still needs decoding/export, provenance checks, class mapping, duplicate/group checks, a protected test split, training and evaluation. **Do not claim bean coverage has already been added to the deployed classifier.**

Additional field datasets such as PlantWild/PlantSeg are research options, not current trained support. Licensing and overlap must be reviewed before use; related datasets must not be treated as independent tests just because they have different names. Collecting representative Indian field data with expert labels is more important than merely increasing image count.

## 13. Why these models, and why not others?

No exhaustive architecture competition was run. The following explains present design choices and future tests, not invented benchmark victories.

| Alternative | Where it could help | Why it is not currently the production answer |
|---|---|---|
| MobileNetV2 | Compact image classification | Implemented baseline; older deployed artifact needs stronger validation |
| EfficientNetV2B0 | Transfer-learned image classification | Evaluated candidate; stronger internal result but failed field/generalization gate |
| ResNet/DenseNet | Useful CNN comparison baselines | Not established as better or worse here by a controlled experiment |
| Vision Transformer/ConvNeXt | Potentially strong image representations | No equivalent repository benchmark, latency study or deployment validation |
| YOLO/DETR | Locate multiple pests/leaves/lesions | Requires bounding-box labels and a detection task; current labels are image classes |
| U-Net/segmentation models | Estimate lesion masks/affected area | Requires pixel-level annotation and severity validation |
| SVM/Random Forest on image features | Useful smaller-data baselines | Not evaluated fairly here; raw-pixel use would omit learned spatial representation |
| Random Forest/XGBoost for yield | Nonlinear tabular yield prediction | No fitted, independently validated farm-level artifact installed |
| Linear regression for yield | Interpretable statistical baseline | Requires reliable paired inputs/outcomes; current coefficients are rules |
| ARIMA/ETS/Prophet for prices | Time-series baselines | Need sufficiently long, market-specific, regular time series and rolling backtests |
| LSTM/Transformer for prices | Temporal modeling with sufficient data | Complexity does not repair sparse/irregular data or establish forecast skill |
| Crop simulation such as process-based models | Soil-water-crop mechanisms | Requires weather, soil, cultivar and management calibration beyond current inputs |
| Linear/mixed-integer optimization | Budget/water/labour-constrained plans | Current engine generates one rule-based alternative; no validated objective/constraint system |
| LLM-generated diagnosis/advice | Explanation or retrieval interface | Not an installed core prediction engine; generated wording cannot replace verified diagnosis/evidence |

The right answer to “Why not use XGBoost everywhere?” is that images, accounting, agronomic response and time series are different tasks. Use a model only where its data and evaluation justify it. Deterministic arithmetic is appropriate for known costs; a trained predictor needs trustworthy targets.

## 14. Data authenticity and provenance

“Authentic” means traceable to an identified publisher and version with understood usage terms. It does not mean perfect labels, independent samples, local representativeness or guaranteed accuracy.

| Data family | Current role | Main caveat |
|---|---|---|
| All-India crop yield CSV | Yield baseline | National aggregate, not localized; product units/basis matter |
| Commodity price CSV | Historical daily medians/statistics | Coverage, age and market mixing limit forecasts |
| Static crop/soil/NPK/cost tables | Rule parameters | Configured assumptions need expert validation |
| PlantVillage/PlantDoc | Candidate classifier training/evaluation | Domain shift, label noise, residual grouping leakage |
| Weather provider | Observed/forecast conditions | Provider availability and forecast error |
| Mandi/MSP providers and stored records | Price/policy context | Date, commodity, market and source must accompany values |
| Manual soil/farmer reports | User observations | Not independently verified measurements |
| Sensor adapters | Potential device observations | Vendor configuration and physical calibration unproven |

Dataset source URLs and revisions are recorded in Appendix E. Hashes protect identity/integrity; they do not prove scientific validity. Never silently turn a failed API into a live-looking fabricated observation.

## 15. Security, registration, deployment and operational constraints

The repository contains input validation, finite-number checks, image-upload validation, request identifiers, sensitive-data masking, rate limiting and file consistency protections. Registration and consent flows exist, but this is not evidence of comprehensive authentication, authorization, encrypted storage, independent penetration testing or production compliance.

JAM means Jan Dhan–Aadhaar–Mobile in the project's integration concept. Official verification is not integrated. Demo Aadhaar behavior is gated by `ENABLE_DEMO_IDENTITY`; mock downstream land/bank/benefit logic must not be presented as real verification. A consent record is an application record, not proof that a government service authorized access. Avoid real identity documents in the demonstration.

Prototype persistence uses files, and some serverless deployments can use temporary storage. Multiple instances, restarts, concurrent users and retention requirements need durable shared storage and access controls. In-memory rate limiting does not by itself protect a distributed deployment. Frontend caching improves resilience but can retain stale observations; source and timestamps remain necessary.

External APIs need configuration, connectivity and service availability. The test run warned that `EXTERNAL_API_KEY` was not configured and that development used a temporary secret. Do not call that production-ready configuration. Training in Colab provides compute; it is not the serving infrastructure and its runtime/files are not permanent unless exported.

No measured nationwide concurrency, uptime, cost-per-farmer or production inference latency is established by this guide. A free-to-farmer interface still incurs hosting, data, support and validation costs. Financial sustainability is a future operating-model question, not a proven result.

## 16. Competitor analysis — primary sources checked 23 September 2026

These are different categories of competitors or adjacent systems. The comparison is qualitative. We did not run their products on our test set, audit their algorithms or establish absence of unadvertised features.

| System | What its official material describes | Implication for Krishyak |
|---|---|---|
| NPSS | Government AI-enabled pest surveillance and advisory infrastructure. PIB reports, as of July 2026, over 10,000 extension workers, 73 crops and 436 pests. [PIB factsheet](https://www.pib.gov.in/FactsheetDetails.aspx?Id=150838&lang=15&reg=24) | Its coverage and operational network exceed what this prototype has demonstrated. Compare as a surveillance/advisory system, not merely “crop detection.” |
| Plantix | Free photo-based crop diagnosis, treatment suggestions, expert community and crop knowledge library. [Plantix](https://plantix.net/en/) | Photo diagnosis and being free are not unique claims. Our proposed emphasis is transparent farm economics and scenario comparison alongside health assistance. |
| AgroStar | Farm advisory, agricultural inputs, app/advisory-centre/retail access and market linkages. [AgroStar](https://corporate.agrostar.in/) | It combines advice and delivery channels. Krishyak has not demonstrated equivalent distribution, expert support or market execution. |
| Cropin | Agricultural cloud, farm records/monitoring, data integration, crop-health intelligence, irrigation and yield-related tools. [Cropin](https://www.cropin.com/) | It overlaps broadly in farm intelligence. Position Krishyak around an inspectable farmer-facing prototype, not a claim that integrated intelligence is new. |

### Can we say “better than NPSS”?

**No, not from the current evidence.** We have no paired, representative, expert-labeled comparison with NPSS. A 93.71% internal classifier result does not compare directly with another system's crop/pest coverage, advisories or field accuracy. No comparable accuracy figure was established in the primary pages reviewed.

To substantiate a future comparison: define common crops and diseases; obtain appropriate access; collect an untouched representative Indian field test set; label through qualified experts; test both systems on the same cases; include unknown/healthy/poor-image cases; report accuracy, per-class recall, false reassurance, abstention, latency and coverage; use paired statistics and publish limitations. This is a proposed protocol, not work already completed.

### USP and defensibility

The strongest pitch is the combination of **explainable input-to-yield-to-cost-to-profit scenarios**, crop-health assistance, local-language interaction, and explicit evidence labels. A farmer can inspect what changed and what was assumed.

The present differentiation is an integration and transparency choice. A durable advantage would require locally validated datasets, expert-reviewed agronomy, useful workflow design, reliable deployment and farmer trust. A dashboard or CNN architecture alone is not a defensible moat. No patent novelty, unique market position or user adoption is established.

## 17. Current work, unfinished work and roadmap

### Already present and checked

The code supports scenario calculation, cost breakdowns, risk scoring, price-baseline outputs, image inference, fertilizer recipes, weather/market/soil/pest interfaces, multilingual UI and validation/error contracts. Publisher-only candidate training and artifact evaluation are complete. The newer candidate remains unpromoted.

### Currently being developed or audited

- Dataset expansion, including downloaded Makerere Beans data awaiting integration.
- Stronger separation of supported prediction, heuristic estimates and unavailable external evidence.
- Repository correctness and cross-engine consistency, including the weather key mismatch and conflicting nutrient assumptions identified in this guide.
- Field generalization and defensible model-release criteria.

No training run is asserted to be active merely because a Colab notebook is open. The saved candidate run completed 11 epochs.

### Prioritized next steps

| Priority | Work | Evidence needed to call it successful |
|---|---|---|
| 1 | Correct threshold lookup and reconcile units/crop aliases/product bases | Focused regression tests and reviewed examples |
| 2 | Unify fertilizer/yield nutrient assumptions with agronomist input | Documented regional crop-stage references and expert review |
| 3 | Complete bean-data preparation and license/provenance review | Reproducible manifest, labels, duplicate groups and protected evaluation |
| 4 | Collect Indian farm/session-separated images including unknown problems | Expert labels, consent/provenance and representative coverage |
| 5 | Improve disease generalization and calibration | Untouched field metrics, per-class minimums, reliability/abstention analysis |
| 6 | Build farm-level yield dataset and baseline comparisons | Spatial/temporal holdouts; MAE/RMSE/bias by crop and region |
| 7 | Obtain market-specific longitudinal prices | Rolling-origin backtests against persistence, realistic costs and missingness |
| 8 | Add constrained planning | Explicit water, budget, labour and action constraints; validated outcome model |
| 9 | Production persistence/security and observability | Auth/access-control review, durable storage, load/failure/restore tests |
| 10 | Farmer pilot and operating model | Usability, comprehension, adoption, cost and outcome evidence |

For future regression evaluation: `MAE = mean(|prediction−actual|)` and `RMSE = sqrt(mean((prediction−actual)^2))`. These are proposed evaluation metrics, not currently achieved results. For future calibration, compare predicted probabilities with observed frequencies and report performance versus abstention coverage. Do not select a threshold on the final test set.

## 18. Verification performed for this guide

On 23 September 2026:

| Check | Result | What it establishes |
|---|---|---|
| Backend `python -m unittest discover -p 'test_*.py'` | **139 tests passed** | Covered calculation/API/storage/training-data contract regressions |
| Frontend `npm test -- --runInBand --silent` | **210 tests passed across 27 suites** | Covered component, cache, response and validation behavior |
| Frontend `npm run build` | **Passed**, including ESLint | Current frontend compiles and passes configured lint |
| Build warning | Main bundle remains over 500 kB minified | Performance work remains; successful build does not mean ideal mobile performance |
| Candidate saved evaluation/artifact reports | Read and cross-checked | Recorded model/manifest/results can be traced to files |
| Competitor primary pages | Reviewed | Supports the limited comparison above |

Tests emitted dependency/deprecation and development-configuration warnings. They do not establish that every external service is currently connected. This documentation pass did not perform a fresh full real-device browser walkthrough, independent security audit, field trial or new model training. Passing tests does not prove no bugs: the weather lookup mismatch is a concrete example of missing coverage.

### Reproduce local checks

```powershell
# From backend, with its existing environment:
.\venv\Scripts\python.exe -m unittest discover -p 'test_*.py'

# From frontend:
npm test -- --runInBand --silent
npm run build
```

Use the existing environment rather than changing dependencies immediately before presentation. The repository is a modified working tree, so a commit hash alone would not describe all current contents. This guide is a dated snapshot, not an assertion that all changes are committed or deployed.

## 19. Demonstration and speaking sequence

### Suggested five-minute narrative

1. **Problem (30 seconds):** farmers need decisions connecting crop condition, inputs and economics, with understandable assumptions.
2. **Workflow (60 seconds):** enter crop, area and farming inputs; show current/alternative/stress results and itemized costs.
3. **Explainability (60 seconds):** open the yield modifiers and risk components. Explain one input change and its effect. Identify assumptions.
4. **Crop health (45 seconds):** demonstrate an appropriate image; distinguish a classifier score from proven diagnostic reliability. State supported coverage.
5. **Evidence (45 seconds):** show validation/internal/external metrics together and explain why the candidate is not promoted.
6. **Differentiation and roadmap (60 seconds):** transparent economics plus health workflow; field validation, localized agronomy and reliable integration are next.

Suggested closing sentence: “Our contribution is an inspectable decision-support workflow; our next milestone is proving its reliability on representative Indian farm data before making stronger deployment claims.”

### Pre-presentation cross-check

- Confirm the backend/frontend start and their API URL/CORS configuration match.
- Confirm which model bundle the running backend actually loads; do not assume the candidate is active.
- Use explicit area, seed, fertilizer and labour units; enter a defensible demonstration price.
- Prepare a clearly labeled illustrative calculation and the saved evaluation report if connectivity fails.
- Check date/source on market and weather cards; never relabel cached data as live.
- Avoid official identity-verification demonstrations and real sensitive identity data.
- Keep unsupported crop, low-confidence and unavailable-service behavior visible if asked.
- If a result looks wrong, explain the limitation rather than substituting a fabricated successful output.

## 20. Judge follow-ups and answers

**1. Is the whole project AI?** No. Image classification uses trained ML. Most other engines are transparent rules, arithmetic or statistical baselines. That distinction is explicit.

**2. What is your actual accuracy?** The latest candidate has 94.39% validation, 93.71% internal test and 57.21% external PlantDoc accuracy. The default installed model is a different older artifact. There is no one accuracy for the entire application.

**3. Why is external accuracy much lower?** The evidence is consistent with domain shift: controlled images differ from complex real scenes. Labels, class balance and limited external sample size also matter. We have not isolated every cause experimentally.

**4. Have you beaten NPSS?** No. A fair shared benchmark has not been performed. Our current contribution is the explainable integrated workflow, and comparative accuracy remains a future test.

**5. Why not deploy the new model immediately?** It fails the stated internal/external release gate. Internal improvement alone is insufficient evidence of reliable deployment performance.

**6. Is 94% validation accuracy fake?** The saved result is traceable to 5,112 correct predictions out of 5,416. It is a real result on that partition; presenting it as field accuracy would be misleading.

**7. What prevents data leakage?** Group-based splits, publisher revisions, duplicate/perceptual-hash checks, conflict quarantine and legacy-overlap reservation. They reduce known leakage but do not prove every farm/session relationship is known.

**8. Is the 229-image external set enough?** It reveals a serious generalization gap but is too small and unrepresentative for a broad national claim. Its Wilson interval is about 50.73–63.44%.

**9. Why 0.75 confidence threshold?** It is a current uncertainty policy, not a calibrated reliability threshold. Future field calibration and error/coverage tradeoffs should determine it.

**10. Can it detect any crop disease?** No. Labels are finite; even a supported crop may have diseases absent from training. The crop dropdown is broader than classifier coverage.

**11. Can it quantify damage severity?** Not reliably. Classification is not lesion segmentation or field-level incidence measurement.

**12. How does disease detection change yield?** There is no validated direct mapping. Yield uses a separate user/scenario pest input and fixed loss rule. Integrating image severity causally is future work.

**13. Why these risk weights?** They are explicit design assumptions prioritizing weather, then price/pests, then soil. They have not been statistically optimized or calibrated against losses.

**14. Does a risk score of 70 mean 70% failure probability?** No. It is a weighted index used for comparison under the current rules.

**15. Does 80% profitable simulations mean an 80% real chance of profit?** No. It means 80% of samples drawn from specified assumed ranges were profitable in this calculator.

**16. Is the alternative plan optimal?** No global search is performed. It is one rule-generated alternative, retained only when modeled profit is not lower.

**17. Why is your price forecast flat?** No validated directional forecasting model is installed. Persistence is an honest baseline until a better model demonstrates out-of-time skill.

**18. Can you tell farmers the best sale date?** Not currently. The output explicitly says timing is unsupported.

**19. Why not use LSTM for prices?** We first need long, consistent market-specific series and a rolling comparison with simpler baselines. Model complexity is not evidence of forecast quality.

**20. How accurate is yield?** No field validation metric has been established. It is an explainable heuristic around national/static baselines.

**21. Why multiply the yield factors?** It gives an inspectable relative-effect model and allows stresses to compound. It also simplifies interactions and needs calibration.

**22. Are fertilizer doses based on soil tests?** The display can compare compatible nutrient measurements, but doses are generic crop-stage recipes. They are not calibrated soil-test recommendations.

**23. Why do fertilizer and yield NPK targets differ?** They were configured in separate modules. This is a known inconsistency requiring expert-reviewed unification, not something we claim is scientifically resolved.

**24. What does authentic dataset mean?** Identified publisher, version, provenance and usable terms. Authenticity alone does not guarantee label quality or Indian field relevance.

**25. Have beans already been added?** Publisher data are downloaded; training/inference integration is unfinished. The current model's label list is the source of truth.

**26. Are the sensor integrations live?** Adapter code and manual/cached workflows exist. Live physical device/vendor validation has not been established here.

**27. Are weather alerts crop-specific?** Crop thresholds are configured, but a case-mismatch lookup currently sends those names to defaults. We recorded this as an unresolved defect rather than claiming full crop-specific behavior.

**28. Are government benefits and Aadhaar verified?** No official integration is established. Demo scaffolding and consent interfaces must be labeled accordingly.

**29. What happens without internet?** Some saved observations/results can be shown with age/source information. New server-side inference and live provider data still need connectivity.

**30. Are all 23 languages fully supported?** There are 23 locale codes. Translation completeness, terminology and browser speech availability still need language-specific validation.

**31. What makes this unique if Plantix is free?** Free diagnosis is not our unique claim. Our proposed emphasis is inspectable farm economics and scenarios combined with health assistance; market uniqueness remains to be validated.

**32. Is it secure and production ready?** It has useful safeguards and passing regression tests, but durable multi-user storage, comprehensive access controls, deployment/load testing and independent review remain necessary.

**33. How do you know the training artifact is genuine?** Saved model and manifest hashes, prediction files, confusion matrices, evaluation reports and training logs identify the evaluated run. These establish traceability, not universal accuracy.

**34. What have tests proven?** 139 backend tests, 210 frontend tests and the lint/build pass demonstrate their covered contracts. They do not prove field accuracy, all integrations or absence of bugs.

**35. What is your next most valuable improvement?** Representative expert-labeled field data and agronomist-reviewed calculation consistency, followed by independent evaluation. More architecture complexity alone is unlikely to resolve the main evidence gap.

**36. Can you guarantee higher farmer income?** No. The app provides estimates under assumptions. Income impact requires a properly designed pilot with real outcomes and a comparison group.

## 21. Claims to avoid and accurate replacements

| Avoid | Say instead |
|---|---|
| “94% accurate in the field” | “93.71% internal and 57.21% external test accuracy for the evaluated candidate” |
| “Better than government NPSS” | “No paired comparison yet; we focus on explainable scenario economics” |
| “AI predicts exact yield” | “A rule-based yield estimate using stated baseline and modifiers” |
| “Optimal plan” | “Rule-generated alternative under current assumptions” |
| “80% chance of profit” | “80% profitable runs under these sampled assumptions” |
| “Real-time data everywhere” | “Live, cached, historical or unavailable, depending on source/status” |
| “Government verified farmer” | “Registration/consent workflow; official verification not integrated” |
| “All crops supported” | “Coverage differs by engine; check the classifier label list” |
| “Fully offline” | “Some cached information remains accessible; new services need connectivity” |
| “Every issue fixed” | “Current regression checks pass; documented defects and validation gaps remain” |

## 22. Source map

| Subject | Repository evidence |
|---|---|
| Request contracts and endpoints | [backend/main.py](backend/main.py) |
| Baselines and constants | [backend/config.py](backend/config.py), [backend/data_loader.py](backend/data_loader.py) |
| Main calculations | [yield](backend/yield_estimator.py), [cost](backend/cost_calculator.py), [risk](backend/risk_engine.py), [simulation](backend/simulation_engine.py), [price](backend/price_forecaster.py) |
| Agronomy and observations | [fertilizer](backend/fertilizer_analyzer.py), [weather](backend/weather_alerts.py), [pest](backend/pest_intelligence.py), [sensors](backend/sensor_adapter.py), [soil cache](backend/soil_data_cache.py) |
| Model runtime | [backend/model_inference.py](backend/model_inference.py), [backend/disease_detector.py](backend/disease_detector.py) |
| Dataset/training pipeline | [manifest preparation](backend/prepare_disease_manifest.py), [training](backend/train_authentic_model.py), [fine-tuning](backend/finetune_disease_model.py), [evaluation](backend/evaluate_disease_bundle.py) |
| Candidate evidence | [evaluation.json](backend/training_runs/publisher-efficientnet-colab-v1/evaluation.json), [data_audit.json](backend/training_runs/publisher-efficientnet-colab-v1/data_audit.json), [finetuning.json](backend/training_runs/publisher-efficientnet-colab-v1/finetuning.json), [artifact verification](backend/training_runs/publisher-efficientnet-colab-v1/artifact_verification.json) |
| Truthful prediction metadata | [backend/hybrid_inference.py](backend/hybrid_inference.py) |
| Security/identity/persistence | [security](backend/security.py), [rate limiter](backend/rate_limiter.py), [JAM](backend/jam_trinity.py), [registration store](backend/registration_store.py) |
| Interface and dependencies | [frontend/src/App.jsx](frontend/src/App.jsx), [frontend/package.json](frontend/package.json) |

The appendices below provide exact static tables, class coverage, per-class results, endpoint inventory and a computed example. They are reference material for follow-up questions rather than a script to recite.

## Appendix A. Exact simulation configuration

All values are configured assumptions, not empirically fitted coefficients.

### Crop catalog: 58 entries

Rice, Wheat, Maize, Barley, Bajra, Jowar, Ragi, Tur, Gram, Urad, Moong, Lentil, Chickpea, Arhar, Groundnut, Soybean, Sunflower, Mustard, Sesame, Cotton, Sugarcane, Jute, Tobacco, Potato, Onion, Tomato, Brinjal, Cabbage, Cauliflower, Okra, Carrot, Green Peas, Spinach, Chilli, Garlic, Ginger, Coriander, Capsicum, Cucumber, Pumpkin, Radish, Mango, Banana, Grapes, Pomegranate, Orange, Guava, Papaya, Apple, Watermelon, Lemon, Coconut, Litchi, Turmeric, Cumin, Fenugreek, Black Pepper, Cardamom

### Static fallback yields (kg/ha)

| Crop | Yield |
| --- | --- |
| Rice | 2899 |
| Wheat | 3587 |
| Maize | 3518 |
| Barley | 3049 |
| Bajra | 1507 |
| Jowar | 1225 |
| Ragi | 1492 |
| Tur | 823 |
| Gram | 1180 |
| Urad | 697 |
| Moong | 685 |
| Lentil | 1038 |
| Chickpea | 1100 |
| Arhar | 850 |
| Groundnut | 1800 |
| Soybean | 1200 |
| Sunflower | 800 |
| Mustard | 1200 |
| Sesame | 400 |
| Cotton | 500 |
| Sugarcane | 75000 |
| Jute | 2500 |
| Tobacco | 1800 |
| Potato | 22000 |
| Onion | 18000 |
| Tomato | 25000 |
| Brinjal | 30000 |
| Cabbage | 25000 |
| Cauliflower | 20000 |
| Okra | 10000 |
| Carrot | 20000 |
| Green Peas | 8000 |
| Spinach | 15000 |
| Chilli | 5000 |
| Garlic | 8000 |
| Ginger | 15000 |
| Coriander | 2000 |
| Capsicum | 15000 |
| Cucumber | 20000 |
| Pumpkin | 25000 |
| Radish | 18000 |
| Mango | 8000 |
| Banana | 35000 |
| Grapes | 20000 |
| Pomegranate | 12000 |
| Orange | 15000 |
| Guava | 20000 |
| Papaya | 40000 |
| Apple | 10000 |
| Watermelon | 30000 |
| Lemon | 15000 |
| Coconut | 12000 |
| Litchi | 6000 |
| Turmeric | 5000 |
| Cumin | 600 |
| Fenugreek | 1200 |
| Black Pepper | 500 |
| Cardamom | 250 |


### Complete soil compatibility matrix

| Crop | Alluvial | Black | Red | Laterite | Desert | Mountain | Loamy | Clay | Sandy |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Rice | 0.95 | 0.7 | 0.6 | 0.5 | 0.2 | 0.4 | 0.85 | 0.9 | 0.3 |
| Wheat | 0.9 | 0.85 | 0.7 | 0.5 | 0.3 | 0.6 | 0.9 | 0.8 | 0.4 |
| Maize | 0.85 | 0.9 | 0.8 | 0.6 | 0.4 | 0.7 | 0.9 | 0.75 | 0.5 |
| Barley | 0.85 | 0.8 | 0.7 | 0.5 | 0.4 | 0.7 | 0.85 | 0.75 | 0.5 |
| Bajra | 0.7 | 0.75 | 0.8 | 0.6 | 0.85 | 0.5 | 0.8 | 0.6 | 0.9 |
| Jowar | 0.75 | 0.9 | 0.8 | 0.6 | 0.7 | 0.5 | 0.85 | 0.75 | 0.6 |
| Gram | 0.8 | 0.9 | 0.75 | 0.5 | 0.4 | 0.55 | 0.9 | 0.7 | 0.4 |
| Lentil | 0.85 | 0.8 | 0.7 | 0.5 | 0.35 | 0.5 | 0.9 | 0.7 | 0.4 |
| Moong | 0.85 | 0.8 | 0.75 | 0.55 | 0.4 | 0.5 | 0.9 | 0.65 | 0.5 |
| Urad | 0.85 | 0.85 | 0.75 | 0.55 | 0.35 | 0.5 | 0.9 | 0.7 | 0.45 |
| Cotton | 0.8 | 0.95 | 0.75 | 0.6 | 0.5 | 0.5 | 0.8 | 0.85 | 0.6 |
| Sugarcane | 0.9 | 0.85 | 0.7 | 0.6 | 0.3 | 0.5 | 0.9 | 0.8 | 0.4 |
| Potato | 0.9 | 0.7 | 0.85 | 0.6 | 0.4 | 0.8 | 0.95 | 0.6 | 0.75 |
| Onion | 0.85 | 0.75 | 0.9 | 0.6 | 0.5 | 0.6 | 0.95 | 0.6 | 0.7 |
| Tomato | 0.85 | 0.8 | 0.9 | 0.65 | 0.45 | 0.7 | 0.95 | 0.65 | 0.7 |
| Brinjal | 0.85 | 0.8 | 0.85 | 0.6 | 0.4 | 0.6 | 0.9 | 0.7 | 0.6 |
| Cabbage | 0.85 | 0.75 | 0.8 | 0.6 | 0.35 | 0.85 | 0.95 | 0.7 | 0.55 |
| Cauliflower | 0.85 | 0.75 | 0.8 | 0.6 | 0.35 | 0.85 | 0.95 | 0.7 | 0.55 |
| Okra | 0.85 | 0.85 | 0.8 | 0.6 | 0.45 | 0.55 | 0.9 | 0.7 | 0.65 |
| Chilli | 0.8 | 0.85 | 0.85 | 0.65 | 0.45 | 0.6 | 0.9 | 0.7 | 0.6 |
| Carrot | 0.8 | 0.65 | 0.75 | 0.5 | 0.4 | 0.75 | 0.95 | 0.5 | 0.85 |
| Green Peas | 0.85 | 0.75 | 0.7 | 0.55 | 0.35 | 0.8 | 0.95 | 0.65 | 0.5 |
| Spinach | 0.85 | 0.8 | 0.75 | 0.6 | 0.35 | 0.7 | 0.9 | 0.75 | 0.55 |
| Garlic | 0.85 | 0.75 | 0.8 | 0.55 | 0.45 | 0.65 | 0.95 | 0.6 | 0.75 |
| Ginger | 0.8 | 0.7 | 0.85 | 0.75 | 0.3 | 0.8 | 0.95 | 0.55 | 0.7 |
| Mango | 0.85 | 0.75 | 0.9 | 0.8 | 0.4 | 0.5 | 0.9 | 0.6 | 0.7 |
| Banana | 0.9 | 0.8 | 0.75 | 0.7 | 0.3 | 0.4 | 0.95 | 0.75 | 0.55 |
| Grapes | 0.75 | 0.9 | 0.85 | 0.6 | 0.5 | 0.55 | 0.85 | 0.6 | 0.75 |
| Pomegranate | 0.7 | 0.85 | 0.9 | 0.65 | 0.7 | 0.55 | 0.85 | 0.55 | 0.8 |
| Orange | 0.8 | 0.75 | 0.85 | 0.7 | 0.4 | 0.65 | 0.9 | 0.6 | 0.7 |
| Guava | 0.85 | 0.8 | 0.8 | 0.65 | 0.5 | 0.55 | 0.9 | 0.7 | 0.65 |
| Papaya | 0.85 | 0.75 | 0.8 | 0.65 | 0.4 | 0.45 | 0.9 | 0.6 | 0.75 |
| Watermelon | 0.8 | 0.7 | 0.75 | 0.55 | 0.65 | 0.4 | 0.85 | 0.55 | 0.9 |
| Lemon | 0.8 | 0.75 | 0.85 | 0.7 | 0.45 | 0.6 | 0.9 | 0.6 | 0.7 |
| Turmeric | 0.8 | 0.7 | 0.9 | 0.75 | 0.3 | 0.6 | 0.95 | 0.6 | 0.55 |
| Cumin | 0.75 | 0.8 | 0.75 | 0.5 | 0.7 | 0.5 | 0.85 | 0.55 | 0.8 |


### SOIL_TYPES

```json
[
  "Alluvial",
  "Black",
  "Red",
  "Laterite",
  "Desert",
  "Mountain",
  "Loamy",
  "Clay",
  "Sandy"
]
```

### SEASONS

```json
[
  "Kharif",
  "Rabi",
  "Summer",
  "Perennial"
]
```

### FERTILIZERS

```json
{
  "Urea": {
    "N": 46,
    "P": 0,
    "K": 0,
    "cost_per_kg": 6
  },
  "DAP": {
    "N": 18,
    "P": 46,
    "K": 0,
    "cost_per_kg": 27
  },
  "MOP": {
    "N": 0,
    "P": 0,
    "K": 60,
    "cost_per_kg": 17
  },
  "NPK": {
    "N": 12,
    "P": 32,
    "K": 16,
    "cost_per_kg": 22
  },
  "Organic": {
    "N": 5,
    "P": 3,
    "K": 2,
    "cost_per_kg": 8
  }
}
```

### COST_PARAMS

```json
{
  "seed_cost_per_kg": {
    "Rice": 40,
    "Wheat": 25,
    "Maize": 35,
    "Cotton": 800,
    "Potato": 35,
    "Tomato": 2500,
    "Onion": 150,
    "Chilli": 3000,
    "Mango": 500,
    "Banana": 25,
    "Grapes": 100,
    "default": 50
  },
  "irrigation_cost_per_mm": 15,
  "labour_cost_per_day": 400,
  "pesticide_cost_base": 2500,
  "market_fee_percent": 2.5,
  "logistics_cost_per_quintal": 50
}
```

### RISK_WEIGHTS

```json
{
  "weather_uncertainty": 0.3,
  "price_volatility": 0.25,
  "pest_severity": 0.25,
  "soil_mismatch": 0.2
}
```

### SIMULATION_PARAMS

```json
{
  "num_simulations": 500,
  "rainfall_variance": 0.2,
  "temperature_variance": 0.1,
  "pest_prob_range": [
    0,
    0.3
  ],
  "fertilizer_variance": 0.15
}
```

## Appendix B. Exact fertilizer reference tables

These preserve all crop-stage fractions, nutrient contents and configured prices. A listed material is not necessarily used by the active recipe.

### CROP_NPK_REQUIREMENTS

```json
{
  "Rice": {
    "N": 120,
    "P": 60,
    "K": 60,
    "stage_split": {
      "basal": {
        "N": 0.25,
        "P": 1.0,
        "K": 0.5
      },
      "early_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0
      },
      "late_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      },
      "flowering": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      }
    }
  },
  "Wheat": {
    "N": 120,
    "P": 60,
    "K": 40,
    "stage_split": {
      "basal": {
        "N": 0.5,
        "P": 1.0,
        "K": 1.0
      },
      "early_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0
      },
      "flowering": {
        "N": 0.25,
        "P": 0,
        "K": 0
      }
    }
  },
  "Maize": {
    "N": 150,
    "P": 75,
    "K": 60,
    "stage_split": {
      "basal": {
        "N": 0.33,
        "P": 1.0,
        "K": 1.0
      },
      "early_vegetative": {
        "N": 0.33,
        "P": 0,
        "K": 0
      },
      "flowering": {
        "N": 0.34,
        "P": 0,
        "K": 0
      }
    }
  },
  "Gram": {
    "N": 20,
    "P": 60,
    "K": 20,
    "stage_split": {
      "basal": {
        "N": 1.0,
        "P": 1.0,
        "K": 1.0
      }
    }
  },
  "Moong": {
    "N": 20,
    "P": 40,
    "K": 20,
    "stage_split": {
      "basal": {
        "N": 1.0,
        "P": 1.0,
        "K": 1.0
      }
    }
  },
  "Urad": {
    "N": 20,
    "P": 50,
    "K": 25,
    "stage_split": {
      "basal": {
        "N": 1.0,
        "P": 1.0,
        "K": 1.0
      }
    }
  },
  "Cotton": {
    "N": 150,
    "P": 75,
    "K": 75,
    "stage_split": {
      "basal": {
        "N": 0.25,
        "P": 1.0,
        "K": 0.5
      },
      "early_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0
      },
      "flowering": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      },
      "grain_filling": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      }
    }
  },
  "Sugarcane": {
    "N": 300,
    "P": 100,
    "K": 150,
    "stage_split": {
      "basal": {
        "N": 0.2,
        "P": 1.0,
        "K": 0.5
      },
      "early_vegetative": {
        "N": 0.3,
        "P": 0,
        "K": 0.25
      },
      "late_vegetative": {
        "N": 0.3,
        "P": 0,
        "K": 0.25
      },
      "flowering": {
        "N": 0.2,
        "P": 0,
        "K": 0
      }
    }
  },
  "Potato": {
    "N": 180,
    "P": 100,
    "K": 150,
    "stage_split": {
      "basal": {
        "N": 0.5,
        "P": 1.0,
        "K": 0.75
      },
      "early_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      },
      "late_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0
      }
    }
  },
  "Tomato": {
    "N": 150,
    "P": 80,
    "K": 100,
    "stage_split": {
      "basal": {
        "N": 0.33,
        "P": 1.0,
        "K": 0.5
      },
      "early_vegetative": {
        "N": 0.33,
        "P": 0,
        "K": 0.25
      },
      "flowering": {
        "N": 0.34,
        "P": 0,
        "K": 0.25
      }
    }
  },
  "Onion": {
    "N": 100,
    "P": 50,
    "K": 80,
    "stage_split": {
      "basal": {
        "N": 0.5,
        "P": 1.0,
        "K": 1.0
      },
      "early_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0
      },
      "late_vegetative": {
        "N": 0.25,
        "P": 0,
        "K": 0
      }
    }
  },
  "Chilli": {
    "N": 120,
    "P": 60,
    "K": 80,
    "stage_split": {
      "basal": {
        "N": 0.33,
        "P": 1.0,
        "K": 0.5
      },
      "early_vegetative": {
        "N": 0.33,
        "P": 0,
        "K": 0.25
      },
      "flowering": {
        "N": 0.34,
        "P": 0,
        "K": 0.25
      }
    }
  },
  "Mango": {
    "N": 100,
    "P": 50,
    "K": 100,
    "stage_split": {
      "basal": {
        "N": 0.5,
        "P": 1.0,
        "K": 0.5
      },
      "flowering": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      },
      "grain_filling": {
        "N": 0.25,
        "P": 0,
        "K": 0.25
      }
    }
  },
  "Banana": {
    "N": 200,
    "P": 60,
    "K": 300,
    "stage_split": {
      "basal": {
        "N": 0.33,
        "P": 1.0,
        "K": 0.33
      },
      "early_vegetative": {
        "N": 0.33,
        "P": 0,
        "K": 0.33
      },
      "flowering": {
        "N": 0.34,
        "P": 0,
        "K": 0.34
      }
    }
  }
}
```

### DEFAULT_NPK

```json
{
  "N": 100,
  "P": 50,
  "K": 50,
  "stage_split": {
    "basal": {
      "N": 0.5,
      "P": 1.0,
      "K": 1.0
    },
    "early_vegetative": {
      "N": 0.25,
      "P": 0,
      "K": 0
    },
    "flowering": {
      "N": 0.25,
      "P": 0,
      "K": 0
    }
  }
}
```

### FERTILIZERS

```json
{
  "Urea": {
    "N": 46,
    "P": 0,
    "K": 0,
    "cost_per_kg": 6,
    "type": "chemical"
  },
  "DAP": {
    "N": 18,
    "P": 46,
    "K": 0,
    "cost_per_kg": 27,
    "type": "chemical"
  },
  "MOP": {
    "N": 0,
    "P": 0,
    "K": 60,
    "cost_per_kg": 17,
    "type": "chemical"
  },
  "NPK_10_26_26": {
    "N": 10,
    "P": 26,
    "K": 26,
    "cost_per_kg": 22,
    "type": "chemical"
  },
  "NPK_12_32_16": {
    "N": 12,
    "P": 32,
    "K": 16,
    "cost_per_kg": 22,
    "type": "chemical"
  },
  "SSP": {
    "N": 0,
    "P": 16,
    "K": 0,
    "cost_per_kg": 8,
    "type": "chemical"
  },
  "Ammonium_Sulphate": {
    "N": 21,
    "P": 0,
    "K": 0,
    "cost_per_kg": 10,
    "type": "chemical"
  }
}
```

### ORGANIC_ALTERNATIVES

```json
{
  "Vermicompost": {
    "N": 1.5,
    "P": 0.8,
    "K": 0.9,
    "cost_per_kg": 8,
    "rate_kg_ha": 5000
  },
  "FYM": {
    "N": 0.5,
    "P": 0.25,
    "K": 0.5,
    "cost_per_kg": 2,
    "rate_kg_ha": 10000
  },
  "Neem_Cake": {
    "N": 5,
    "P": 1,
    "K": 1.5,
    "cost_per_kg": 25,
    "rate_kg_ha": 200
  },
  "Bone_Meal": {
    "N": 3,
    "P": 20,
    "K": 0,
    "cost_per_kg": 30,
    "rate_kg_ha": 150
  },
  "Wood_Ash": {
    "N": 0,
    "P": 1,
    "K": 5,
    "cost_per_kg": 5,
    "rate_kg_ha": 500
  },
  "Green_Manure": {
    "N": 2,
    "P": 0.5,
    "K": 1.5,
    "cost_per_kg": 0,
    "rate_kg_ha": 0
  }
}
```

## Appendix C. Weather and pest rule tables

Weather crop selection currently has the case mismatch described in Section 11. The pest database is static knowledge, not live outbreak evidence; embedded management text is not independently validated treatment advice.

### Weather thresholds

```json
{
  "Rice": {
    "min_temp": 15,
    "max_temp": 40,
    "min_humidity": 60,
    "max_humidity": 95,
    "drought_days": 7,
    "optimal_rain_mm": 150,
    "spray_wind_max": 15
  },
  "Wheat": {
    "min_temp": 5,
    "max_temp": 30,
    "min_humidity": 40,
    "max_humidity": 80,
    "drought_days": 10,
    "optimal_rain_mm": 100,
    "spray_wind_max": 12
  },
  "Cotton": {
    "min_temp": 18,
    "max_temp": 38,
    "min_humidity": 50,
    "max_humidity": 85,
    "drought_days": 14,
    "optimal_rain_mm": 80,
    "spray_wind_max": 10
  },
  "Sugarcane": {
    "min_temp": 20,
    "max_temp": 42,
    "min_humidity": 70,
    "max_humidity": 95,
    "drought_days": 5,
    "optimal_rain_mm": 200,
    "spray_wind_max": 15
  },
  "default": {
    "min_temp": 10,
    "max_temp": 40,
    "min_humidity": 40,
    "max_humidity": 90,
    "drought_days": 10,
    "optimal_rain_mm": 100,
    "spray_wind_max": 12
  }
}
```

### Pest knowledge base

```json
{
  "rice": {
    "brown_planthopper": {
      "scientific_name": "Nilaparvata lugens",
      "common_name": "Brown Planthopper (BPH)",
      "favorable_conditions": {
        "temp_min": 25,
        "temp_max": 30,
        "humidity_min": 80
      },
      "peak_months": [
        7,
        8,
        9
      ],
      "damage_symptoms": [
        "Hopper burn",
        "Yellowing of leaves",
        "Wilting"
      ],
      "control_measures": [
        "Drain water from field for 3-4 days",
        "Apply Imidacloprid 17.8 SL @ 0.3ml/L",
        "Use light traps (1 per acre)",
        "Avoid excess nitrogen fertilizer"
      ]
    },
    "stem_borer": {
      "scientific_name": "Scirpophaga incertulas",
      "common_name": "Yellow Stem Borer",
      "favorable_conditions": {
        "temp_min": 28,
        "temp_max": 35,
        "humidity_min": 70
      },
      "peak_months": [
        6,
        7,
        8,
        9,
        10
      ],
      "damage_symptoms": [
        "Dead hearts in vegetative stage",
        "White ear heads"
      ],
      "control_measures": [
        "Install pheromone traps (5/acre)",
        "Release Trichogramma japonicum",
        "Apply Chlorantraniliprole 0.4G @ 10kg/ha",
        "Remove and destroy stubbles"
      ]
    },
    "leaf_folder": {
      "scientific_name": "Cnaphalocrocis medinalis",
      "common_name": "Rice Leaf Folder",
      "favorable_conditions": {
        "temp_min": 25,
        "temp_max": 32,
        "humidity_min": 85
      },
      "peak_months": [
        7,
        8,
        9
      ],
      "damage_symptoms": [
        "Longitudinal folding of leaves",
        "Scraping of green tissue"
      ],
      "control_measures": [
        "Spray Flubendiamide 480 SC @ 0.1ml/L",
        "Apply Neem oil @ 3ml/L",
        "Maintain optimum spacing",
        "Avoid excess nitrogen"
      ]
    }
  },
  "wheat": {
    "aphid": {
      "scientific_name": "Sitobion avenae",
      "common_name": "Wheat Aphid",
      "favorable_conditions": {
        "temp_min": 15,
        "temp_max": 25,
        "humidity_min": 60
      },
      "peak_months": [
        1,
        2,
        3
      ],
      "damage_symptoms": [
        "Yellowing of leaves",
        "Stunted growth",
        "Honeydew secretion"
      ],
      "control_measures": [
        "Spray Dimethoate 30 EC @ 1ml/L",
        "Apply Neem seed kernel extract @ 5%",
        "Encourage natural predators (ladybird beetles)",
        "Avoid late sowing"
      ]
    },
    "termite": {
      "scientific_name": "Odontotermes obesus",
      "common_name": "Termite",
      "favorable_conditions": {
        "temp_min": 20,
        "temp_max": 35,
        "humidity_min": 40
      },
      "peak_months": [
        11,
        12,
        1,
        2
      ],
      "damage_symptoms": [
        "Drying of plants in patches",
        "Hollow stems",
        "Mud galleries"
      ],
      "control_measures": [
        "Apply Chlorpyrifos 20 EC @ 4L/ha with irrigation",
        "Use well-decomposed FYM only",
        "Avoid moisture stress",
        "Seed treatment with Imidacloprid"
      ]
    }
  },
  "cotton": {
    "bollworm": {
      "scientific_name": "Helicoverpa armigera",
      "common_name": "American Bollworm",
      "favorable_conditions": {
        "temp_min": 25,
        "temp_max": 35,
        "humidity_min": 50
      },
      "peak_months": [
        7,
        8,
        9,
        10
      ],
      "damage_symptoms": [
        "Bore holes in bolls",
        "Damaged squares",
        "Shedding of flowers"
      ],
      "control_measures": [
        "Install pheromone traps (5/acre)",
        "Spray Emamectin benzoate 5 SG @ 0.4g/L",
        "Release Trichogramma chilonis",
        "Grow trap crops (marigold, castor)"
      ]
    },
    "whitefly": {
      "scientific_name": "Bemisia tabaci",
      "common_name": "Cotton Whitefly",
      "favorable_conditions": {
        "temp_min": 28,
        "temp_max": 38,
        "humidity_min": 60
      },
      "peak_months": [
        8,
        9,
        10
      ],
      "damage_symptoms": [
        "Yellowing of leaves",
        "Sticky honeydew",
        "Sooty mold",
        "Leaf curl"
      ],
      "control_measures": [
        "Spray Diafenthiuron 50 WP @ 1g/L",
        "Apply Neem oil @ 5ml/L",
        "Install yellow sticky traps",
        "Remove alternate host weeds"
      ]
    },
    "pink_bollworm": {
      "scientific_name": "Pectinophora gossypiella",
      "common_name": "Pink Bollworm",
      "favorable_conditions": {
        "temp_min": 25,
        "temp_max": 32,
        "humidity_min": 50
      },
      "peak_months": [
        9,
        10,
        11
      ],
      "damage_symptoms": [
        "Rosetted flowers",
        "Pink larvae in bolls",
        "Damaged seeds"
      ],
      "control_measures": [
        "Use Bt cotton varieties",
        "Install pheromone traps",
        "Deep summer ploughing",
        "Destroy crop residues after harvest"
      ]
    }
  },
  "sugarcane": {
    "early_shoot_borer": {
      "scientific_name": "Chilo infuscatellus",
      "common_name": "Early Shoot Borer",
      "favorable_conditions": {
        "temp_min": 28,
        "temp_max": 38,
        "humidity_min": 70
      },
      "peak_months": [
        3,
        4,
        5,
        6
      ],
      "damage_symptoms": [
        "Dead hearts",
        "Bore holes in shoots",
        "Frass in shoots"
      ],
      "control_measures": [
        "Release Trichogramma chilonis @ 50000/ha",
        "Install pheromone traps",
        "Apply Chlorantraniliprole 0.4G @ 20kg/ha",
        "Maintain proper spacing"
      ]
    },
    "top_borer": {
      "scientific_name": "Scirpophaga excerptalis",
      "common_name": "Top Shoot Borer",
      "favorable_conditions": {
        "temp_min": 25,
        "temp_max": 35,
        "humidity_min": 80
      },
      "peak_months": [
        5,
        6,
        7,
        8
      ],
      "damage_symptoms": [
        "Bunchy top",
        "Dead heart",
        "Side shoots"
      ],
      "control_measures": [
        "Detrash leaves up to 3rd internode",
        "Release Cotesia flavipes",
        "Apply Fipronil 5 SC @ 1.5ml/L",
        "Collect and destroy egg masses"
      ]
    },
    "woolly_aphid": {
      "scientific_name": "Ceratovacuna lanigera",
      "common_name": "Sugarcane Woolly Aphid",
      "favorable_conditions": {
        "temp_min": 25,
        "temp_max": 30,
        "humidity_min": 85
      },
      "peak_months": [
        8,
        9,
        10,
        11
      ],
      "damage_symptoms": [
        "White waxy coating",
        "Yellowing",
        "Stunted growth",
        "Sooty mold"
      ],
      "control_measures": [
        "Spray Dimethoate 30 EC @ 2ml/L",
        "Release Dipha aphidivora predator",
        "Detrash affected leaves",
        "Avoid water stress"
      ]
    }
  }
}
```

## Appendix D. Class mappings and per-class results

### Default installed model

| Index | Class |
| --- | --- |
| 0 | American Bollworm on Cotton |
| 1 | Anthracnose on Cotton |
| 2 | Army worm |
| 3 | Becterial Blight in Rice |
| 4 | Brownspot |
| 5 | Common_Rust |
| 6 | Cotton Aphid |
| 7 | Flag Smut |
| 8 | Gray_Leaf_Spot |
| 9 | Healthy Maize |
| 10 | Healthy Wheat |
| 11 | Healthy cotton |
| 12 | Leaf Curl |
| 13 | Leaf smut |
| 14 | Mosaic sugarcane |
| 15 | RedRot sugarcane |
| 16 | RedRust sugarcane |
| 17 | Rice Blast |
| 18 | Sugarcane Healthy |
| 19 | Tungro |
| 20 | Wheat Brown leaf Rust |
| 21 | Wheat Stem fly |
| 22 | Wheat aphid |
| 23 | Wheat black rust |
| 24 | Wheat leaf blight |
| 25 | Wheat mite |
| 26 | Wheat powdery mildew |
| 27 | Wheat scab |
| 28 | Wheat___Yellow_Rust |
| 29 | Wilt |
| 30 | Yellow Rust Sugarcane |
| 31 | bacterial_blight in Cotton |
| 32 | bollrot on Cotton |
| 33 | bollworm on Cotton |
| 34 | cotton mealy bug |
| 35 | cotton whitefly |
| 36 | maize ear rot |
| 37 | maize fall armyworm |
| 38 | maize stem borer |
| 39 | pink bollworm in cotton |
| 40 | red cotton bug |
| 41 | thirps on  cotton |


### Candidate model

| Index | Class |
| --- | --- |
| 0 | Apple___Apple_scab |
| 1 | Apple___Black_rot |
| 2 | Apple___Cedar_apple_rust |
| 3 | Apple___healthy |
| 4 | Blueberry___healthy |
| 5 | Cherry_(including_sour)___Powdery_mildew |
| 6 | Cherry_(including_sour)___healthy |
| 7 | Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot |
| 8 | Corn_(maize)___Common_rust_ |
| 9 | Corn_(maize)___Northern_Leaf_Blight |
| 10 | Corn_(maize)___healthy |
| 11 | Grape___Black_rot |
| 12 | Grape___Esca_(Black_Measles) |
| 13 | Grape___Leaf_blight_(Isariopsis_Leaf_Spot) |
| 14 | Grape___healthy |
| 15 | Orange___Haunglongbing_(Citrus_greening) |
| 16 | Peach___Bacterial_spot |
| 17 | Peach___healthy |
| 18 | Pepper,_bell___Bacterial_spot |
| 19 | Pepper,_bell___healthy |
| 20 | Potato___Early_blight |
| 21 | Potato___Late_blight |
| 22 | Potato___healthy |
| 23 | Raspberry___healthy |
| 24 | Soybean___healthy |
| 25 | Squash___Powdery_mildew |
| 26 | Strawberry___Leaf_scorch |
| 27 | Strawberry___healthy |
| 28 | Tomato___Bacterial_spot |
| 29 | Tomato___Early_blight |
| 30 | Tomato___Late_blight |
| 31 | Tomato___Leaf_Mold |
| 32 | Tomato___Septoria_leaf_spot |
| 33 | Tomato___Spider_mites Two-spotted_spider_mite |
| 34 | Tomato___Target_Spot |
| 35 | Tomato___Tomato_Yellow_Leaf_Curl_Virus |
| 36 | Tomato___Tomato_mosaic_virus |
| 37 | Tomato___healthy |


### test

Support is the number of evaluated true examples; zero support cannot establish recall.

| Class | Support | Precision % | Recall % | F1 % |
| --- | --- | --- | --- | --- |
| Apple___Apple_scab | 143 | 94.64 | 74.13 | 83.14 |
| Apple___Black_rot | 88 | 95.65 | 100.00 | 97.78 |
| Apple___Cedar_apple_rust | 64 | 84.51 | 93.75 | 88.89 |
| Apple___healthy | 321 | 95.73 | 97.82 | 96.76 |
| Blueberry___healthy | 214 | 95.87 | 97.66 | 96.76 |
| Cherry_(including_sour)___Powdery_mildew | 84 | 97.65 | 98.81 | 98.22 |
| Cherry_(including_sour)___healthy | 153 | 94.30 | 97.39 | 95.82 |
| Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot | 79 | 78.87 | 70.89 | 74.67 |
| Corn_(maize)___Common_rust_ | 207 | 96.67 | 98.07 | 97.36 |
| Corn_(maize)___Northern_Leaf_Blight | 174 | 88.20 | 90.23 | 89.20 |
| Corn_(maize)___healthy | 74 | 98.65 | 98.65 | 98.65 |
| Grape___Black_rot | 193 | 98.87 | 90.67 | 94.59 |
| Grape___Esca_(Black_Measles) | 152 | 92.07 | 99.34 | 95.57 |
| Grape___Leaf_blight_(Isariopsis_Leaf_Spot) | 164 | 100.00 | 100.00 | 100.00 |
| Grape___healthy | 78 | 95.12 | 100.00 | 97.50 |
| Orange___Haunglongbing_(Citrus_greening) | 821 | 99.51 | 99.88 | 99.70 |
| Peach___Bacterial_spot | 388 | 96.24 | 98.97 | 97.59 |
| Peach___healthy | 71 | 90.28 | 91.55 | 90.91 |
| Pepper,_bell___Bacterial_spot | 172 | 92.31 | 90.70 | 91.50 |
| Pepper,_bell___healthy | 248 | 95.65 | 97.58 | 96.61 |
| Potato___Early_blight | 191 | 89.95 | 93.72 | 91.79 |
| Potato___Late_blight | 159 | 89.73 | 82.39 | 85.90 |
| Potato___healthy | 24 | 75.00 | 87.50 | 80.77 |
| Raspberry___healthy | 78 | 96.10 | 94.87 | 95.48 |
| Soybean___healthy | 763 | 98.57 | 99.61 | 99.09 |
| Squash___Powdery_mildew | 320 | 99.06 | 99.06 | 99.06 |
| Strawberry___Leaf_scorch | 182 | 99.44 | 98.35 | 98.90 |
| Strawberry___healthy | 70 | 98.41 | 88.57 | 93.23 |
| Tomato___Bacterial_spot | 342 | 87.13 | 95.03 | 90.91 |
| Tomato___Early_blight | 138 | 84.34 | 50.72 | 63.35 |
| Tomato___Late_blight | 311 | 87.62 | 88.75 | 88.18 |
| Tomato___Leaf_Mold | 179 | 88.17 | 83.24 | 85.63 |
| Tomato___Septoria_leaf_spot | 309 | 88.46 | 81.88 | 85.04 |
| Tomato___Spider_mites Two-spotted_spider_mite | 244 | 79.58 | 94.26 | 86.30 |
| Tomato___Target_Spot | 206 | 81.91 | 79.13 | 80.49 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 838 | 98.28 | 95.35 | 96.79 |
| Tomato___Tomato_mosaic_virus | 61 | 89.29 | 81.97 | 85.47 |
| Tomato___healthy | 263 | 85.91 | 97.34 | 91.27 |


### external_test

Support is the number of evaluated true examples; zero support cannot establish recall.

| Class | Support | Precision % | Recall % | F1 % |
| --- | --- | --- | --- | --- |
| Apple___Apple_scab | 10 | 57.14 | 80.00 | 66.67 |
| Apple___Black_rot | 0 | 0.00 | 0.00 | 0.00 |
| Apple___Cedar_apple_rust | 10 | 77.78 | 70.00 | 73.68 |
| Apple___healthy | 9 | 38.46 | 55.56 | 45.45 |
| Blueberry___healthy | 11 | 57.14 | 36.36 | 44.44 |
| Cherry_(including_sour)___Powdery_mildew | 0 | 0.00 | 0.00 | 0.00 |
| Cherry_(including_sour)___healthy | 10 | 40.00 | 20.00 | 26.67 |
| Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot | 3 | 50.00 | 66.67 | 57.14 |
| Corn_(maize)___Common_rust_ | 10 | 80.00 | 80.00 | 80.00 |
| Corn_(maize)___Northern_Leaf_Blight | 10 | 77.78 | 70.00 | 73.68 |
| Corn_(maize)___healthy | 0 | 0.00 | 0.00 | 0.00 |
| Grape___Black_rot | 8 | 83.33 | 62.50 | 71.43 |
| Grape___Esca_(Black_Measles) | 0 | 0.00 | 0.00 | 0.00 |
| Grape___Leaf_blight_(Isariopsis_Leaf_Spot) | 0 | 0.00 | 0.00 | 0.00 |
| Grape___healthy | 12 | 92.31 | 100.00 | 96.00 |
| Orange___Haunglongbing_(Citrus_greening) | 0 | 0.00 | 0.00 | 0.00 |
| Peach___Bacterial_spot | 0 | 0.00 | 0.00 | 0.00 |
| Peach___healthy | 9 | 85.71 | 66.67 | 75.00 |
| Pepper,_bell___Bacterial_spot | 9 | 33.33 | 33.33 | 33.33 |
| Pepper,_bell___healthy | 8 | 55.56 | 62.50 | 58.82 |
| Potato___Early_blight | 6 | 50.00 | 50.00 | 50.00 |
| Potato___Late_blight | 5 | 12.50 | 20.00 | 15.38 |
| Potato___healthy | 0 | 0.00 | 0.00 | 0.00 |
| Raspberry___healthy | 7 | 87.50 | 100.00 | 93.33 |
| Soybean___healthy | 8 | 55.56 | 62.50 | 58.82 |
| Squash___Powdery_mildew | 6 | 80.00 | 66.67 | 72.73 |
| Strawberry___Leaf_scorch | 0 | 0.00 | 0.00 | 0.00 |
| Strawberry___healthy | 8 | 88.89 | 100.00 | 94.12 |
| Tomato___Bacterial_spot | 9 | 0.00 | 0.00 | 0.00 |
| Tomato___Early_blight | 9 | 40.00 | 44.44 | 42.11 |
| Tomato___Late_blight | 11 | 45.45 | 45.45 | 45.45 |
| Tomato___Leaf_Mold | 6 | 33.33 | 66.67 | 44.44 |
| Tomato___Septoria_leaf_spot | 11 | 46.15 | 54.55 | 50.00 |
| Tomato___Spider_mites Two-spotted_spider_mite | 0 | 0.00 | 0.00 | 0.00 |
| Tomato___Target_Spot | 0 | 0.00 | 0.00 | 0.00 |
| Tomato___Tomato_Yellow_Leaf_Curl_Virus | 6 | 100.00 | 83.33 | 90.91 |
| Tomato___Tomato_mosaic_virus | 10 | 50.00 | 20.00 | 28.57 |
| Tomato___healthy | 8 | 60.00 | 37.50 | 46.15 |


## Appendix E. Provenance and artifact identity

| Artifact | SHA-256 |
| --- | --- |
| Candidate model | 5d8b08e61feae381a7bf05f0dea8fe77527e0dcc2dd7b5714f5160eb5341a591 |
| Manifest | 78334f3447b187a50604948d689dce93e0ae0e44120a739b9da0d082765915aa |
| Colab archive | 664729ac450a35641ed84a29f3bc722f0673c06376ae640743e2d502da693a37 |


| Publisher | Source | Revision |
| --- | --- | --- |
| PlantVillage | [PlantVillage](https://github.com/spMohanty/PlantVillage-Dataset) | 7f7ecc7e1eaca78107e3affe7cb5abd9427e139a |
| PlantDoc | [PlantDoc](https://github.com/pratikkayal/PlantDoc-Dataset) | 5467f6012d78d1c446145d5f582da6096f852ae8 |


PlantDoc is recorded as CC-BY-4.0 in the audit. Review publisher terms individually before redistribution or deployment. Hashes establish artifact identity, not scientific validity.

Makerere Beans download revision: `27aa014ce09b193e1a6f58112d4a66e0eddb69c5`; directory `datasets/authentic/MakerereBeans/source`. It is not yet integrated into the trained candidate.

Saved artifact verification checked prediction files. An earlier 64-image local inference spot check matched candidate classes; this establishes reproducibility, not an independent accuracy benchmark.

## Appendix F. API inventory and bounds

Extracted from main.py. Endpoint existence does not prove the external provider is configured.

| Method | Route | Handler | Line |
| --- | --- | --- | --- |
| POST | /register-farmer | register_farmer | 319 |
| GET | / | root | 378 |
| GET | /crops | get_crops | 387 |
| GET | /soils | get_soil_types | 392 |
| GET | /fertilizers | get_fertilizers | 397 |
| POST | /simulate | simulate_farming | 402 |
| POST | /forecast_prices | forecast_commodity_prices | 430 |
| POST | /compare_scenarios | compare_scenarios | 455 |
| POST | /recommend | get_recommendations | 485 |
| GET | /health | health_check | 525 |
| POST | /detect_disease | detect_disease | 533 |
| GET | /disease-capabilities | disease_capabilities | 603 |
| GET | /diseases | get_diseases | 609 |
| GET | /diseases/{crop} | get_diseases_by_crop | 621 |
| GET | /sensors | list_sensors | 661 |
| GET | /sensors/{device_id}/data | get_sensor_data | 682 |
| POST | /sensors/manual | submit_manual_soil_data | 735 |
| GET | /sensors/{device_id}/history | get_sensor_history | 785 |
| GET | /sensors/status | get_sensors_status | 811 |
| POST | /weather/current | get_current_weather | 848 |
| POST | /weather/forecast | get_weather_forecast | 874 |
| POST | /weather/alerts | get_weather_alerts | 899 |
| POST | /weather/rain-forecast | get_rain_forecast | 941 |
| POST | /pest/report | submit_pest_report | 999 |
| POST | /pest/alerts | get_pest_alerts | 1043 |
| GET | /pest/history | get_pest_history | 1085 |
| POST | /pest/prediction | get_pest_prediction | 1115 |
| GET | /pest/statistics | get_pest_statistics | 1152 |
| POST | /fertilizer/recommendation | get_fertilizer_recommendation | 1190 |
| GET | /fertilizer/schedule | get_fertilizer_schedule | 1227 |
| GET | /fertilizer/alternatives | get_organic_alternatives | 1249 |
| POST | /consent/request | request_consent | 1291 |
| POST | /consent/grant/{consent_id} | grant_consent | 1314 |
| POST | /consent/revoke/{consent_id} | revoke_consent | 1341 |
| POST | /verify/aadhaar | verify_aadhaar | 1366 |
| POST | /verify/land | verify_land_records | 1403 |
| POST | /verify/jan-dhan | verify_jan_dhan | 1442 |
| POST | /verify/pm-kisan-status | get_pm_kisan_status | 1479 |
| POST | /farmer/profile | get_farmer_profile | 1510 |
| GET | /land/supported-states | get_supported_states | 1534 |
| GET | /api/msp/prices | get_msp_prices | 1563 |
| GET | /api/msp/prices/{crop} | get_msp_for_specific_crop | 1583 |
| GET | /api/mandi/prices | get_live_mandi_prices | 1611 |
| GET | /api/locations/states | get_indian_states | 1646 |
| GET | /api/locations/districts | get_district_suggestions | 1663 |
| GET | /api/locations/tehsils | get_tehsil_suggestions | 1670 |


### Main input guardrails

| Input | Bounds |
| --- | --- |
| Area | >0 to 1,000,000 ha; fertilizer API <=1,000 ha |
| Seed quality, pest input, control | 0 to 1 |
| Rainfall | 0 to 20,000 mm |
| Delay | 0 to 365 days |
| Irrigation | 0 to 100 events/month |
| Fertilizer quantity | 0 to 100,000 kg/ha, finite, known type |
| Labour | >0 to 10,000,000 total person-days |
| Sale month | integer 0 to 12 |
| Sale price | >0 to 10,000,000 INR/quintal |
| Seed quantity | optional 0 to 100,000,000 total kg |
| Season duration | >0 to 24 months |
| Simulation count | 100 to 2,000 |
| Forecast horizon | 1 to 180 days |
| Manual N/P/K | 0 to 500 / 200 / 500 respectively |
| Manual pH/moisture | 0 to 14 / 0 to 100% |
| Manual temperature | -10 to 60 degrees C |
| Manual organic carbon | 0 to 20% |


Software guardrails do not establish agronomic realism. Names are catalog-checked and nonfinite inputs rejected.

## Appendix G. Worked example executed through current code

Illustrative inputs, not observed farm data: Rice, Alluvial, 1 ha, assumed baseline 3,000 kg/ha, seed quality 0.8, rain 1,200 mm, zero delay, irrigation twice/month over 4 months, Urea/DAP/MOP 150/80/60 kg/ha, pest input 0.2, seed 50 kg total, labour 30 person-days, control intensity 0.5, selling price INR 2,500/quintal.

### Computed yield

```json
{
  "yield_per_hectare": 3110.15,
  "total_production_kg": 3110.15,
  "total_production_quintals": 31.1,
  "base_yield": 3000,
  "baseline_metadata": {
    "value": 3000,
    "source": "illustrative_assumption",
    "units": "kg/ha"
  },
  "confidence": 0.86,
  "confidence_kind": "uncalibrated_input_suitability_score",
  "method": "multiplicative_agronomic_heuristic",
  "modifiers": {
    "soil": 0.95,
    "rainfall": 1.0,
    "irrigation": 1.02,
    "fertilizer": 1.163,
    "seed_quality": 1.0,
    "pest_impact": 0.92,
    "total": 1.037
  }
}
```

### Computed costs (INR)

```json
{
  "total_cost": 39006.75,
  "cost_per_quintal": 1254.24,
  "cost_per_hectare": 39006.75,
  "breakdown": {
    "seed_cost": 2000,
    "fertilizer_cost": 4080,
    "irrigation_cost": 4200.0,
    "labour_cost": 12000,
    "pesticide_cost": 2500.0,
    "land_preparation": 3500,
    "harvesting_cost": 4000,
    "market_fees": 1943.75,
    "logistics_cost": 1555.0,
    "miscellaneous": 3228.0
  }
}
```

| Output | Value |
| --- | --- |
| Revenue INR | 77750.00 |
| Profit INR | 38743.25 |
| ROI % | 99.32 |


Returned rounded production is used for costs/revenue. Rounded displayed modifiers may not multiply back to exactly the reported yield. Reproducible arithmetic does not guarantee the assumed farm outcome.

## Appendix H. Fast revision card

- Learned model: image classifier; main farm engines: rules and arithmetic.
- Candidate: EfficientNetV2B0, 38 classes, 14 crop categories, not promoted.
- Results: 94.39% validation; 93.71% internal; 57.21% external.
- Yield: baseline times six modifiers.
- Risk: weather 30%, price 25%, pest 25%, soil 20%, plus input-score penalty.
- Profit: revenue minus included costs.
- Monte Carlo: assumed sensitivity, not calibrated probability.
- Price: persistence; no validated sale date.
- USP: inspectable economics/scenarios alongside crop-health assistance.
- NPSS superiority: not established.
- Next: representative field validation and agronomic consistency.
- Checks: 139 backend tests, 210 frontend tests, lint/build passed.
