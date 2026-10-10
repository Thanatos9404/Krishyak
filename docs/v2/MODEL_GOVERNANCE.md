# Model governance

`backend/models/active/release.json` remains authoritative. The active model is
`publisher-efficientnet-colab-v1`, EfficientNetV2B0, 38 classes across 14 crops.
No new checkpoint was trained or promoted in this implementation.
The active label map is stored with its original hashed bytes; Git line-ending
normalization is disabled for that artifact to preserve Linux/Windows integrity.

| Evaluation | Samples | Accuracy |
|---|---:|---:|
| Validation | 5,416 | 94.3870% |
| Internal test | 8,566 | 93.7077% |
| External PlantDoc | 229 | 57.2052% |

External Wilson 95% interval is 50.7299–63.4428%. Historical legacy validation
96.875% on 512 samples is not the current external field result. Runtime/parity
smokes are not accuracy evaluations. Float32 compact LiteRT inference preserves
the existing release contract; training/authoring dependencies remain separate.

Photo results include model identity, unsupported/uncertain states and raw score
limitations. Scores are not calibrated diagnostic probabilities. Unsupported
crop identity skips inference. No severity, pesticide dose or universal health
score is inferred from a leaf photo or satellite observation.

Farmer feedback is separate from expert corrections. Experts require a fresh
privileged session, current research consent and active class labels; corrections
are audited. Withdrawal immediately removes the image from review/monitoring.
Feedback rates are selected operational evidence, not independent accuracy.
No background retraining or automatic class/checkpoint promotion occurs.

Release gate: acquisition/license and consent inventory; field/district/crop/
device grouping before splitting; leaf/field duplicate and hash checks; blinded
expert labels; untouched independent test set; per-class balanced accuracy,
macro-F1, sensitivity and abstention/coverage; calibration/domain-shift review;
external comparison; hashed artifacts and signed reviewer decision. Preserve the
prior release for rollback. Failed candidates remain candidates.
