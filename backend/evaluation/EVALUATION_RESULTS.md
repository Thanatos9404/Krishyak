# Plant-disease classifier evaluation results

## Run record

- **Date:** 1 September 2026
- **Model:** `backend/models/plant_disease_model.h5`
- **Class map:** `backend/models/class_indices.json` (42 classes)
- **Data:** `datasets/pdisease/Validation`
- **Samples:** 3,173 labelled images across all 42 model classes
- **Preprocessing:** RGB conversion, resize to 224 × 224, divide pixel values by 255
- **Runtime:** Python 3.12.5; TensorFlow 2.20.0; scikit-learn 1.3.2; Pillow 12.0.0

This is a post-hoc evaluation of the supplied checkpoint on the folder named `Validation`. It is **not** an independent external/field test set and must be presented as validation performance.

## Exact metrics

| Metric | Exact value | Rounded |
|---|---:|---:|
| Top-1 accuracy | 0.7809643870154428 | 78.10% |
| Top-3 accuracy | 0.9095493224078159 | 90.95% |
| Balanced accuracy | 0.6510074581047647 | 65.10% |
| Macro precision | 0.6037162506637443 | 60.37% |
| Macro recall | 0.6510074581047647 | 65.10% |
| Macro F1 | 0.5978507334794498 | 59.79% |
| Weighted precision | 0.8062117706768737 | 80.62% |
| Weighted recall | 0.7809643870154428 | 78.10% |
| Weighted F1 | 0.7768808391510714 | 77.69% |

ROUGE is **not applicable**. This model selects one image class; it does not generate or rank natural-language text against a reference text.

## Interpretation

The large gap between weighted F1 (77.69%) and macro F1 (59.79%) matters: large classes such as `Wilt` and `Healthy Maize` perform well, while several small classes have zero F1. Therefore use macro recall/F1 and the confusion matrix alongside accuracy.

Highest observed F1 scores include `Wilt` (0.96), `Healthy Maize` (0.96), `RedRot sugarcane` (0.93), and `RedRust sugarcane` (0.91). Zero-F1 classes are `Anthracnose on Cotton` (10 images), `bollrot on Cotton` (2), `Leaf smut` (16), and `Wheat Brown leaf Rust` (15). This is evidence of uneven class performance, not a reason to omit those classes from the report.

The largest observed off-diagonal error is `Cotton Aphid` predicted as `bacterial_blight in Cotton` (61 images). Other sizeable errors include `Army worm` predicted as `bacterial_blight in Cotton` (26) and `Army worm` predicted as `maize fall armyworm` (24).

## Evidence files

- `metrics.json` — machine-readable aggregate metrics.
- `classification_report.json` — exact per-class precision, recall, F1, and support.
- `confusion_matrix.csv` — actual class by predicted class counts.
- `per_image_predictions.csv` — path, true/predicted classes, and winning softmax confidence for every evaluated image.

## Claims that are and are not supported

Supported: “The supplied MobileNetV2 checkpoint achieved 78.10% top-1 validation accuracy and 77.69% weighted F1 on the repository’s 3,173-image validation folder.”

Not supported: 95.2% accuracy, 0.94 F1, 0.93 recall, ResNet/VGG/EfficientNet comparison values, an ablation table, “field-test accuracy,” ROUGE, or a CPU-latency number. The repository has no historical evidence or competing checkpoints/training logs to reproduce these claims.
