# Krishyak Technical Project Guide

This is the technical, evidence-first explanation of the current repository. It distinguishes what is implemented from what is only a UI-facing heuristic or fallback. It is the document to use when presenting Krishyak.

## 1. What Krishyak is

Krishyak is a FastAPI + React decision-support application for crop-planning scenarios. Its backend combines one trained image classifier with deterministic agronomy, cost, risk, weather, market, fertilizer, pest, eligibility, and sensor-integration modules. It is not a single end-to-end AI system: most planning outputs are transparent formulas or rules, and that is the honest way to present them.

The project has three distinct output types:

1. **ML prediction:** the leaf-image classifier in `backend/models/plant_disease_model.h5`.
2. **Statistical simulation:** randomised price paths and Monte Carlo what-if runs.
3. **Rule/knowledge-base output:** crop-yield modifiers, NPK gap calculations, thresholds, treatment tables, government-scheme checks, and UX fallbacks.

## 2. Evidence and evaluation status

### What is present

- Checkpoint: `backend/models/plant_disease_model.h5` (19,233,824 bytes).
- Class map: `backend/models/class_indices.json`, with 42 classes.
- Labelled evaluation candidate: `datasets/pdisease/Validation`, with 3,173 images in 42 folders.
- Training code: `backend/train_model.py`.
- Reproducible evaluator: `backend/evaluate_plant_disease_model.py`.

### Prior evidence gap and current result

There is no original training console output, TensorBoard event file, or history CSV/JSON. A reproducible post-hoc evaluation was therefore run on 1 September 2026 using the supplied checkpoint and every labelled image in `datasets/pdisease/Validation`. The complete artifacts are in `backend/evaluation/`.

| Metric | Exact value | Presentation value |
|---|---:|---:|
| Top-1 accuracy | 0.7809643870 | **78.10%** |
| Top-3 accuracy | 0.9095493224 | **90.95%** |
| Balanced accuracy / macro recall | 0.6510074581 | **65.10%** |
| Macro precision | 0.6037162507 | **60.37%** |
| Macro F1 | 0.5978507335 | **59.79%** |
| Weighted precision | 0.8062117707 | **80.62%** |
| Weighted recall | 0.7809643870 | **78.10%** |
| Weighted F1 | 0.7768808392 | **77.69%** |

This is a **validation-set** result, not an independent field-test result. It supersedes the unsupported 95.2% / 0.94 / 0.93 claims removed from `details.md`. No AUC, latency benchmark, competing-model benchmark, or ablation result can be recovered because there are no stored baseline checkpoints, timing run, or training histories.

`datasets/pdisease/test/test` has 33 unlabelled PlantVillage sample images. It cannot be used for accuracy metrics. The validation folder is the proper labelled evaluation candidate. Its folder names vary only in punctuation/case for two labels; the evaluator normalises names safely rather than trusting alphabetical folder order.

### Exact evaluation command

The recorded run used the existing `backend/venv` (Python 3.12.5, TensorFlow 2.20.0, scikit-learn 1.3.2, Pillow 12.0.0):

```powershell
cd backend
.\venv\Scripts\python.exe -m pip install -r requirements-eval.txt
.\venv\Scripts\python.exe evaluate_plant_disease_model.py
```

It writes `backend/evaluation/metrics.json`, `classification_report.json`, `confusion_matrix.csv`, and `per_image_predictions.csv`. Report the values in `metrics.json`, not a rounded value copied into slides. The 3,173-image run includes JPG, JPEG, PNG, GIF, TIFF, BMP, and WEBP files.

The evaluator reports top-1/top-3 accuracy, balanced accuracy, macro and weighted precision/recall/F1, a per-class report, and the exact confusion matrix. ROUGE is deliberately `null`: ROUGE measures n-gram overlap between generated and reference **text**, so it has no valid interpretation for a single-label leaf-image classifier.

## 3. Disease classifier

### Implemented algorithm

`train_model.py` builds a transfer-learning CNN:

- **Backbone:** ImageNet-pretrained MobileNetV2 with `include_top=False`.
- **Head:** global average pooling → batch normalisation → Dense(512, ReLU) → dropout(0.5) → batch normalisation → Dense(256, ReLU) → dropout(0.3) → Dense(42, softmax).
- **Input:** RGB image resized to 224 × 224, scaled as `x / 255`.
- **Loss:** categorical cross-entropy, \(L=-\sum_{c=1}^{42}y_c\log(p_c)\).
- **Optimizer:** Adam: \(\theta_{t+1}=\theta_t-\alpha\hat m_t/(\sqrt{\hat v_t}+\epsilon)\).
- **Training:** phase 1 freezes the backbone; phase 2 unfreezes MobileNetV2 layers 100 onward at a lower learning rate. Checkpointing selects maximum `val_accuracy`; early stopping and learning-rate reduction monitor `val_loss`.
- **Augmentation:** rotations up to 40°, shifts/shear/zoom up to 0.2, horizontal/vertical flips, and brightness 0.8–1.2.

MobileNetV2 is suitable here because depthwise-separable convolutions and inverted residual/linear-bottleneck blocks reduce compute relative to conventional full convolutions. It is a reasonable deployment trade-off for a 224 px image classifier, but its measured accuracy and latency must be produced by the evaluator/benchmark before stating them.

### Why these metrics

- **Accuracy:** \((TP+TN)/(TP+TN+FP+FN)\); easy overall summary but dominated by common classes.
- **Precision:** \(TP/(TP+FP)\); false disease alarms matter because they can cause unnecessary treatment.
- **Recall:** \(TP/(TP+FN)\); missed disease is agronomically costly.
- **F1:** \(2PR/(P+R)\); balances the preceding two measures.
- **Macro average:** equal weight per class; exposes poor minority-class performance.
- **Weighted average:** weights each class by support; describes expected performance on this validation distribution.
- **Balanced accuracy:** mean class recall; useful under the clearly uneven validation counts.
- **Top-3 accuracy:** correct label is among the top three; useful as an assistive diagnostic option, not as the primary prediction claim.

ROC-AUC is not emitted because multi-class one-vs-rest AUC can be reported later but is less intuitive for a hard 42-way diagnosis. Calibration error and external-field-test recall are more valuable next steps.

### Alternatives and why not used now

- **EfficientNetV2 / ConvNeXt / ViT:** potentially stronger accuracy but need a controlled benchmark, more compute, and careful augmentation/tuning; no such evidence currently exists.
- **ResNet50:** established baseline but larger/slower than MobileNetV2; use only after measuring the same split and device.
- **Model ensembles:** may improve accuracy but make mobile/cloud inference, maintenance, and calibration harder.
- **Segmentation (U-Net/SAM) before classification:** useful if leaf/background clutter is large; not necessary for the current clean directory dataset but valuable for real field photos.

## 4. Planning and economic engines

| Engine | Code | Actual method | Why it is used | Important limitation |
|---|---|---|---|---|
| Yield estimator | `yield_estimator.py` | Multiplicative rule model | Transparent and immediate with sparse inputs | Not a fitted yield-regression model |
| Cost calculator | `cost_calculator.py` | Arithmetic cost ledger | Shows seed, fertiliser, irrigation, labour, pesticide, preparation, harvesting, logistics and 10% miscellaneous cost | Unit prices are static assumptions |
| Risk engine | `risk_engine.py` | Weighted threshold score | Explainable prioritisation of risk drivers | Weights/thresholds are not learned or statistically calibrated |
| Price forecaster | `price_forecaster.py` | Drift + random shock + sinusoidal seasonality | Produces a reproducible illustrative 60-day path | It is not SARIMA and has no fitted confidence interval/backtest |
| Monte Carlo scenario engine | `simulation_engine.py` | Repeated perturb-and-recalculate sampling | Shows output range under stated uncertainty | Input distributions are heuristic and independent |
| Fertiliser analyser | `fertilizer_analyzer.py` | Nutrient-gap / staged dose rules | Converts soil NPK and crop stage into a concrete schedule | Needs local soil/lab validation before advisory use |
| Pest intelligence | `pest_intelligence.py` | Weather threshold scoring + seasonal/location rules | Simple, inspectable alerts | Some generated outbreak/confidence data are simulated |
| Weather alerts | `weather_alerts.py` | Crop-specific threshold rules over Open-Meteo forecast | Low-latency actionable weather warnings | Forecast/API fallback uncertainty is not propagated |
| Mandi/MSP service | `mandi_adapter.py`, `gov_api_service.py` | Live/cached/fallback fetches and static records | Service continuity with source metadata | Freshness depends on provider/API availability |
| Scheme/JAM/land tools | `jam_trinity.py`, `land_records.py` | Consent/token/state validation and mockable adapters | Demonstrates safe integration boundaries | Not a direct production Aadhaar, bank, or land-record integration |
| Soil sensor adapter | `sensor_adapter.py` | Vendor-adapter pattern + manual fallback | Allows hardware integration without tying UI to one vendor | No active sensor hardware is included in the repository |

### Yield equation

The implemented calculation is

\[
Y=A\,Y_0\,f_{soil}f_{rain}f_{delay}f_{irrigation}f_{NPK}f_{seed}f_{pest}
\]

where \(Y_0\) is a historical/default crop baseline and \(A\) is area. Rainfall is scored against crop-specific ranges, delayed rain receives a 1.5% per-day penalty capped at 40%, irrigation is capped at a 30% gain, seed factor is \(0.6+0.5q\), and pest loss is \(1-0.4p\). It is used because every output driver is inspectable. A gradient-boosting regression model would be better only after obtaining representative, labelled farmer outcomes with districts, seasons, inputs, weather, and market data.

### Cost, revenue, and ROI

\[
Revenue=Q_{quintal}\times P_{sale},\quad Profit=Revenue-TotalCost,\quad ROI=100\times Profit/TotalCost.
\]

The cost engine totals listed input and operational items and adds 10% miscellaneous cost. This is a budgeting estimator; it is not a guarantee of farm profitability.

### Risk score

\[
R=0.30R_{weather}+0.25R_{price}+0.25R_{pest}+0.20R_{soil}+10(1-C_{yield}).
\]

Each component is on 0–100. The last term raises risk when yield confidence \(C_{yield}\) is low. Categories are Low <25, Moderate <50, High <70, Very High otherwise. The weights provide a consistent, explainable ranking; they are not causal coefficients. A better future method is calibrated probabilistic risk modelling or a Bayesian network learned from observed crop losses.

### Price path

The code uses daily return mean \(\mu\), return standard deviation \(\sigma\) (with minimum 0.05), normal shock \(\epsilon_t\), and a 30-day sinusoidal term \(s_t\):

\[
P_t=\max(0.5P_0,\;P_{t-1}+P_{t-1}(\mu+\sigma\epsilon_t+s_t)).
\]

The selling window is every day at least 95% of the simulated peak. This is a stochastic illustrative forecast, not ARIMA/SARIMA despite older wording elsewhere. Better alternatives are SARIMAX with exogenous rainfall/arrival-volume features, Prophet, or probabilistic deep time-series models—chosen only after backtesting against date-based holdout data.

## 5. Monte Carlo: exactly what the app does

For each what-if request, the engine produces three deterministic scenarios (current, rule-optimised, worst) and then runs `num_simulations` micro-simulations. It sets `numpy.random.seed(42)` at the start, so the same input and code produce the same simulated result.

For micro-run \(i\), it samples:

- rainfall multiplier \(U(0.8,1.2)\);
- pest probability \(U(0,0.3)\);
- fertiliser multiplier \(U(0.85,1.15)\);
- price multiplier \(U(0.9,1.1)\).

It passes each sampled input through the yield, cost, price, revenue, and risk formulas. It returns mean, population standard deviation, minimum, maximum, 25th/75th percentiles, and `probability_of_profit = 100 × count(profit > 0) / N` for profit; analogous summary values are returned for yield and risk.

This is useful because it converts stated uncertainty into an outcome distribution rather than a single number. It is not a probability forecast calibrated from historical losses: distributions are simple uniform assumptions, variables are independent, and the fixed seed makes it reproducible but not more accurate. A future version should model correlated weather/pest/price variables, use empirical distributions, report 5th/50th/95th percentiles and confidence intervals, and validate predicted intervals against seasons held out by time and district.

## 6. Data, APIs, and frontend

The frontend is React 18/Vite with Tailwind, Recharts, browser Web Speech recognition, i18n locale JSON files, and a mobile-oriented dashboard. Backend data handling uses Pandas/NumPy and local crop-yield/mandi data when present. Weather uses Open-Meteo with a deterministic fallback; geocoding, SoilGrids, data.gov.in, and other external services are described in `datasetused.md` and require credentials/availability as applicable.

Voice entry is browser speech recognition plus application-side dictionary/regex-style intent handling; it is not a custom trained ASR or NLU model. Disease “visual search” in `disease_detector.py` is a deterministic hash-based simulation and treatment lookup, not real reverse-image search. Be explicit about both points when demoing.

## 7. Judge questions to prepare for

1. **Which result is actually ML?** The 42-class MobileNetV2 leaf classifier; planning outputs are rule/statistical/simulation based.
2. **Where are the metrics?** Run the included evaluator on the labelled validation folder and show its JSON/CSV outputs. Do not cite the removed unsupported values.
3. **Why no ROUGE?** ROUGE is for generated text overlap and is invalid for image classification.
4. **How do you avoid class imbalance hiding errors?** Show macro recall/F1, balanced accuracy, per-class support, and the confusion matrix—not accuracy alone.
5. **Does the validation set represent farm photos?** Not necessarily. It is an in-repository validation split; an external, field-photo test set is required before deployment claims.
6. **Why MobileNetV2?** It is an efficient transfer-learning CNN appropriate for 224 px images; substantiate latency/accuracy only after benchmarking this checkpoint.
7. **Is the price model SARIMA?** No. The current code is a simplified drift-shock-seasonality simulation; present it exactly that way.
8. **What makes a Monte Carlo result trustworthy?** The math is reproducible and assumptions are visible; predictive trust requires empirical/calibrated distributions and backtests, which are future work.
9. **How are recommendations kept safe?** They are decision support, display sources/freshness/fallbacks where implemented, and must not replace agronomist/local-extension advice.
10. **What happens without internet or sensor data?** The app uses static/manual/deterministic fallbacks; clearly label their source and freshness.
11. **Is JAM/Aadhaar integrated with production systems?** No direct production identity/bank/land access is present; it is an adapter/consent workflow demonstration.
12. **How will you improve it?** Collect consented field outcomes, version datasets/models, use geographic/time holdouts, calibrate probabilities, benchmark alternatives, and monitor drift.

## 8. Presentation-safe claims

Say: “The app combines a MobileNetV2 leaf classifier with transparent agronomy, cost, risk, and Monte Carlo scenario models.”

Say: “The simulation shows conditional estimates under explicit assumptions, not guaranteed yield or profit.”

Do not say: “95.2% accuracy,” “0.94 F1,” “93% recall,” “SARIMA,” “real reverse-image search,” “trained XGBoost,” or “production JAM integration” unless new traceable evidence/code has been added.
