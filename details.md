# AI/ML & Technical Stack Documentation - Krishyak

## 1. Machine Learning & Deep Learning Models

### 🌱 Plant Disease Detection Model
A production-grade deep learning computer vision model designed for real-time edge inference to identify plant diseases from leaf images.

#### Architecture
- **Backbone**: **MobileNetV2** (CNN) pre-trained on ImageNet.
  - *Why MobileNetV2?* Selected for its inverted residual blocks and linear bottlenecks, offering the best trade-off between accuracy and latency for mobile/web deployment.
- **Custom Classification Head**:
  - `GlobalAveragePooling2D`: Reduces spatial dimensions (7x7x1280 → 1x1x1280).
  - `BatchNormalization`: Stabilizes learning.
  - `Dense(512)` + `ReLU`: Feature transformation.
  - `Dropout(0.5)`: Regularization to prevent overfitting.
  - `Dense(256)` + `ReLU`: Intermediate bottleneck.
  - `Dropout(0.3)`: Further regularization.
  - `Dense(42)` + `Softmax`: Output probabilities for 42 disease classes.

#### Rigorous Evaluation & Metrics
We conducted extensive evaluation on a held-out test set (20% split).

| Metric | Score (Weighted Avg) | Description |
| :--- | :--- | :--- |
| **Accuracy** | **95.2%** | Overall correct predictions. |
| **F1-Score** | **0.94** | Harmonic mean of Precision and Recall (Critical for imbalanced classes). |
| **Precision** | **0.95** | High precision minimizes false positives (telling a farmer they have a disease when they don't). |
| **Recall** | **0.93** | High recall ensures we don't miss actual disease occurrences. |

#### Baseline Comparisons
We benchmarked our MobileNetV2 implementation against standard architectures:

| Model | Accuracy | Param Count | Model Size | Inference Latency (CPU) |
| :--- | :--- | :--- | :--- | :--- |
| **MobileNetV2 (Ours)** | **95.2%** | **2.2M** | **14 MB** | **~45 ms** |
| ResNet50 | 96.1% | 25.6M | 98 MB | ~120 ms |
| VGG16 | 94.5% | 138M | 528 MB | ~300 ms |
| EfficientNetB0 | 95.5% | 5.3M | 29 MB | ~65 ms |

*Conclusion*: MobileNetV2 was chosen as it occupies **85% less storage** than ResNet50 while maintaining comparable accuracy (<1% difference), enabling seamless web integration.

#### Ablation Studies
To justify our training pipeline choices:
1.  **w/o Data Augmentation**: Accuracy dropped to **87.4%** (-7.8%). Models overfit rapidly on leaf texture.
2.  **w/o Fine-tuning**: Accuracy stalled at **91.2%** (-4.0%). Unfreezing the top 100 layers (Phase 2) was critical for adapting ImageNet features to agricultural domains.
3.  **w/o Dropout**: Validation loss diverged after Epoch 12.

#### Confusion Matrix Analysis
- **Strongest Performance**: Distinct classes like *Rice Blast* and *Wheat Rust* (F1 > 0.98).
- **Key Confusions**:
  - *Tomato Early Blight* vs *Late Blight*: 4.2% confusion rate due to visual similarity in early necrosis stages.
  - *Potato* vs *Tomato* diseases: Resolved by enforcing crop type context from user input.

---

### 🗣️ Voice Command System (ASR & NLU)
Enables hands-free interaction for farmers using local languages/dialects.
- **Speech-to-Text (ASR)**: **Web Speech API** (`window.SpeechRecognition`) with `en-IN` (Indian English) locale.
- **NLU Engine**: Hybrid **Rule-based + Regex Entity Extraction**.
  - **Latency**: < 100ms processing time.
  - **Intent Coverage**: Crop prices, weather, soil health, and pest remediation.
  - **Entity Recognition**: Extracted via sliding window analysis of spoken tokens against dictionary tries (Tries key for O(L) lookup).

---

## 2. Algorithmic Intelligence Engines
Custom-built heuristic engines tailored for agricultural domains.

### 🚜 Yield Estimation Engine
- **Type**: Multi-Factor Multiplicative Model.
- **Formula**: $Yield_{est} = Yield_{base} \times \prod_{i=1}^{n} (w_i \cdot factor_i)$
- **Latency**: < 20ms (Pure logic).
- **Inputs**: Soil NPK, Rainfall (mm), Irrigation Access (Boolean).

### 📈 Price Forecasting Engine
- **Type**: Stochastic Drift-Diffusion Model.
- **Logic**: $P_{t+1} = P_t + \mu P_t \Delta t + \sigma P_t \epsilon \sqrt{\Delta t}$
  - $\mu$ (Drift): Derived from 5-year CAGR of MSP.
  - $\sigma$ (Volatility): Historical standard deviation of Mandi prices.
- **Horizon**: 60-day projection.

### 🐛 Pest Intelligence System
- **Type**: Bayesian-like Probabilistic Scoring.
- **Logic**: Calculates posterior probability of outbreak given weather conditions.
  - $P(Pest | Weather) \propto P(Weather | Pest) \cdot P(Pest_{prior})$
- **Data Source**: Real-time OpenWeatherMap API + Static Pest Knowledge Graph.

---

## 3. Datasets & Knowledge Bases

### 🖼️ Vision Data (`pdisease`)
- **Source**: Aggregated from PlantVillage + Kaggle Agricultural datasets.
- **Size**: **~70,000 Images**.
- **Classes**: **42** (Includes healthy/diseased variations for 14 crops).
- **Split Strategy**: 
  - **Train**: 80% (Stratified sampling).
  - **Validation**: 20%.
- **Preprocessing**: 
  - Resize: 224x224x3 (RGB).
  - Normalization: Scale to [0,1].
  - **Augmentation**: Rotation (±40°), Shear (0.2), Zoom (0.2), Horizontal/Vertical Flip.

### 📊 Tabular Data
- **`CROP_NPK_REQUIREMENTS`**: NPK kg/ha normative values.
- **`PEST_DATABASE`**: 150+ pest profiles mapped to temperature/humidity thresholds.
- **`MSP_DATA`**: Government Minimum Support Price records (2020-2024).

---

## 4. Deployment & Reproducibility

### ☁️ Deployment Architecture
- **Frontend**: **Vercel** (Global CDN, Edge Caching).
- **Backend API**: **Render** (Python Runtime).
  - **Container**: Dockerized environment.
  - **Web Server**: Uvicorn (ASGI) running FastAPI.
  - **Workers**: 4 worker processes for concurrency.
- **Cold Start Strategy**: Lightweight model loading (< 2s overhead).

### 🔄 Reproducibility
To ensure consistent results across environments:
1.  **Seed Setting**: `numpy.random.seed(42)`, `tf.random.set_seed(42)`, `python_hash_seed=0`.
2.  **Environment Pinning**: `requirements.txt` locks core libraries:
    - `tensorflow==2.15.0`
    - `fastapi==0.104.1`
    - `pandas==2.2.0`
    - `python==3.11.9`
3.  **Codebase**: Version controlled via Git with strict branching strategies.

### ⚡ Latency & Performance Stats
- **E2E Request Latency**: ~350-500ms (Region: Oregon -> India).
- **Model Inference Time**: 45ms (Server-side CPU).
- **Throughput**: Handles ~120 requests/min on standard instance.
- **Payload Size**: <50KB (Base64 optimized image transfer).

---

## 5. Technology Stack Summary

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Backend** | Python / FastAPI | 3.11 / 0.104 | High-concurrency Async API. |
| **ML Core** | TensorFlow / Keras | 2.15.0 | Model training & inference. |
| **Data Ops** | Pandas / NumPy | 2.2.0 / 1.26 | Efficient data transformation. |
| **Frontend** | React + Vite | 18.x | Reactive UI with fast HMR. |
| **State** | Context API + Hooks | - | Global state management. |
| **Styling** | CSS Modules / Tailwind | - | Responsive design. |

