# Model governance

`backend/models/active/release.json` remains authoritative; every figure below
is copied from it or from `serving-check.json` beside it. The active model is
`krishyak-leaf-v3`: two EfficientNetV2B2 networks at 288 pixels whose
predictions are averaged, 85 classes across 18 crops. It replaced
`krishyak-leaf-v2` on 21 November 2026, which had replaced
`publisher-efficientnet-colab-v1` (38 classes, 14 crops) the day before. The
label map is stored with its original hashed bytes; Git line-ending
normalization is disabled for that artifact. Where every photograph comes
from is in `LEAF_DATASETS.md`.

## How it was built

Code: `backend/leaf_v2/` (`manifest.py`, `train.py`, `evaluate.py`,
`compare.py`, `ensemble.py`, `release.py`, `serve_check.py`).

- **Data.** 103,530 photographs after cleaning (11,220 exact or near
  duplicates removed, 1,623 with conflicting labels set aside). 22,854 are
  from documented Indian farms: paddy from Tamil Nadu, tomato from Rajasthan,
  rice from Odisha, sugarcane and cotton from Maharashtra, plus two small sets
  from Kashmir and Jalgaon that are never trained on. Duplicate groups never
  straddle a split.
- **Backbone choice.** Eight ImageNet backbones were compared as frozen
  feature extractors, scored by macro-F1 on field validation photographs:
  ConvNeXt-Tiny 0.607 (27.8 M parameters), DenseNet121 0.607 (7.0 M),
  EfficientNetV2B2 0.604 (8.8 M), EfficientNetV2B3 0.595, EfficientNetV2S
  0.591, EfficientNetV2B0 0.582, MobileNetV3Large 0.569, ResNet50V2 0.501.
  EfficientNetV2B2 was taken: within noise of the best at a third of the size.
- **Two training runs.** Member 1 is the v2 network (14 epochs, dropout 0.3).
  Member 2 was trained on 21 November with the Pune cotton photographs added,
  18 epochs, dropout 0.4 and twice the weight decay. Both use label smoothing,
  mixup, phone-style augmentation, class-balanced sampling with field
  photographs weighted three times, and keep the epoch with the best macro-F1
  on field validation photographs.
- **Choosing between them.** Photograph by photograph, member 2 beats member 1
  on field test photographs (198 against 150 photographs that only one gets
  right, p = 0.012) and on Indian farm test photographs (62 against 38,
  p = 0.021), but is worse on the 300 unseen-farm photographs (9 against 22,
  p = 0.029); on PlantDoc the difference is not significant (6 against 11,
  p = 0.33). Averaging the two networks' weights did not work: validation
  macro-F1 dips between them, so the best "average" was member 2 alone.
  Averaging their predictions gives the best field-validation macro-F1 of the
  three candidates (0.8817 against 0.8808 and 0.8736), which is the rule
  used to choose, and it is the released model.
- **Answering rule.** The farmer selects the crop, so only that crop's
  conditions compete. If less than 30 % of the model's belief is on that crop
  the photograph is treated as another plant and gets no answer. Otherwise
  the model answers only at 0.75 confidence or more. The validation rule
  would allow 0.30; lower values gave more confidently wrong answers on
  photographs from unfamiliar sources, so 0.75 was kept. That choice was made
  with the external results in view.

## Results

With the crop selected, as the app asks:

| Photographs | Samples | Accuracy (95 % interval) | Macro precision | Macro recall | Macro F1 |
|---|---:|---:|---:|---:|---:|
| Indian farm test (held-out photographs of the five Indian sources trained on) | 3,659 | 95.7 % (94.9 to 96.3) | 0.948 | 0.932 | 0.936 |
| The same without the Odisha rice set | 2,885 | 94.5 % | | | |
| All field test photographs | 7,742 | 91.7 % (91.1 to 92.3) | 0.897 | 0.888 | 0.890 |
| Studio test | 8,727 | 99.4 % (99.3 to 99.6) | 0.993 | 0.994 | 0.993 |
| External PlantDoc hold-out | 235 | 83.4 % (78.1 to 87.6) | 0.837 | 0.808 | 0.810 |
| Indian farms never trained on (Kashmir apple, Jalgaon cotton) | 300 | 47.0 % (41.4 to 52.7) | 0.745 | 0.574 | 0.464 |

Indian farm test by source: Tamil Nadu paddy 94.0 % (1,628), Rajasthan tomato
92.4 % (727), Maharashtra sugarcane 99.5 % (379), Pune cotton 96.7 % (151),
Odisha rice 100 % (774). The Odisha figure is not trusted: see
`LEAF_DATASETS.md`.

Against v2 on the same photographs:

| Photographs | Samples | v2 accuracy / macro F1 | v3 accuracy / macro F1 |
|---|---:|---:|---:|
| Indian farm test | 3,659 | 94.9 % / 0.922 | 95.7 % / 0.936 |
| All field test | 7,742 | 90.8 % / 0.881 | 91.7 % / 0.890 |
| Studio test | 8,727 | 99.3 % / 0.992 | 99.4 % / 0.993 |
| External PlantDoc | 235 | 85.1 % / 0.830 | 83.4 % / 0.810 |
| Indian farms never trained on | 300 | 48.3 % / 0.485 | 47.0 % / 0.464 |

So v3 is a little better on photographs like the ones it learned from and no
better on photographs from unfamiliar sources. The PlantDoc and unseen-farm
differences are within what 235 and 300 photographs can resolve.

What the farmer sees, measured through the serving path (original
photographs, Pillow decoding, the exported LiteRT artifact, the rule above):

| Photographs | Answered | Right when answering | Confidently wrong per 100 |
|---|---:|---:|---:|
| Indian farm test (3,659) | 92.3 % | 98.1 % | 1.8 |
| Field test sample (1,500) | 85.7 % | 97.4 % | 2.2 |
| External PlantDoc (235) | 68.5 % | 92.6 % | 5.1 |
| Indian farms never trained on (300) | 57.0 % | 57.3 % | 24.3 |
| v2 on external PlantDoc, for comparison | 67.2 % | 94.3 % | 3.8 |

A photograph offered under the wrong crop was answered 0.2 % of the time on
the field test. Calibration error with the crop selected is 0.013 on the
field test, 0.046 on PlantDoc and 0.29 on the unseen farms: there the model
is confident and wrong.

By crop on the field test (accuracy): sugarcane 99.5 %, cotton 98.8 %, rice
95.9 %, wheat 88.1 %, maize 87.2 %, potato 85.3 %, tomato 84.6 %, apple
80.0 %. Weakest conditions (recall): tomato bacterial spot 0.38, wheat leaf
blight 0.49, grape leaf blight 0.57, apple mosaic 0.61, tomato yellow leaf
curl 0.61. Per-class figures are in `release.json`.

## Overfitting and underfitting

Measured, not assumed (`metrics.fit` and `learning_curve` in `release.json`):

| Crop selected, accuracy | Training photographs, no augmentation | Validation | Test |
|---|---:|---:|---:|
| Field photographs | 97.1 % | 91.3 % | 91.7 % |
| Studio photographs | 99.8 % | | 99.4 % |

- **Not underfit.** The model fits its training photographs at 97 % or more.
- **No overfitting to the validation set.** Validation and test agree to
  within half a point, so choosing the epoch on validation did not flatter it.
- **Validation never turned down.** During member 2's training, field
  validation accuracy was still rising at the last epoch (87.0 % at epoch 13,
  88.7 % at epoch 18) while training accuracy rose faster (90.9 % to 94.8 %).
- **A 5.4-point gap remains on field photographs** between training and
  held-out photographs. More dropout and weight decay did not shrink it
  (v2's gap was 5.1 points).
- **The larger gap is between sources, not between splits.** 95.7 % on held-out
  photographs of familiar Indian sources against 47.0 % on two unfamiliar
  ones. Regularisation does not fix this; photographs from more farms do.

## What these numbers do not show

- The two never-trained-on Indian sets are small and of doubtful quality. On
  them the model calls most Kashmir scab leaves healthy (recall 0.27) and
  nearly all Jalgaon "bacterial blight" leaves healthy (recall 0.07), even
  after training on Pune blight photographs. Either those photographs show
  something the training data does not, or their labels are wrong; nobody
  with plant-pathology training has checked. Up to 11 of the 95 Jalgaon
  photographs also exist in the older unverified collection member 1
  trained on.
- No public Indian farm photographs were found for wheat, potato or maize
  diseases. Their figures rest on web photographs and data of unstated origin.
- PlantDoc has no rice, wheat, cotton or sugarcane.
- No photograph in any set was taken by a Krishyak farmer.
- The care steps for the 42 conditions added in v2 are drafts awaiting
  agronomist review.

The exported artifact (float32 LiteRT, 70.2 MB, built-in operators only)
gives the same top class and the same answer/no-answer decision as the Keras
model on 247 inputs (largest probability difference 1.5e-6);
`runtime-verification.json` records this. It runs both members for every
photograph, about 45 ms on a laptop processor. Rollback is a revert of the
release commit, which restores the v2 bundle unchanged.

Photo results include model identity, unsupported/uncertain states and raw score
limitations. Scores are not diagnostic probabilities. Unsupported
crop identity skips inference. No severity, pesticide dose or universal health
score is inferred from a leaf photo or satellite observation.

Farmer feedback is separate from expert corrections. Experts require a fresh
privileged session, current research consent and active class labels; corrections
are audited. Withdrawal immediately removes the image from review/monitoring.
Feedback rates are selected operational evidence, not independent accuracy.
No background retraining or automatic class/checkpoint promotion occurs.

v2 and v3 were promoted on the automated evidence above, at the project owner's
instruction to improve the model. The gate below asks for more than that:
blinded expert labels, an independent Indian field test set and a signed
reviewer decision are still open, and the dataset licences are listed
but not legally reviewed.

Release gate: acquisition/license and consent inventory; field/district/crop/
device grouping before splitting; leaf/field duplicate and hash checks; blinded
expert labels; untouched independent test set; per-class balanced accuracy,
macro-F1, sensitivity and abstention/coverage; calibration/domain-shift review;
external comparison; hashed artifacts and signed reviewer decision. Preserve the
prior release for rollback. Failed candidates remain candidates.
