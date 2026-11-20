# Model governance

`backend/models/active/release.json` remains authoritative; every figure below
is copied from it or from `serving-check.json` beside it. The active model is
`krishyak-leaf-v2`, EfficientNetV2B2 at 288 pixels, 85 classes across 18 crops.
It replaced `publisher-efficientnet-colab-v1` (EfficientNetV2B0, 38 classes,
14 crops) on 20 November 2026. The label map is stored with its original
hashed bytes; Git line-ending normalization is disabled for that artifact.

## How v2 was built

Code: `backend/leaf_v2/` (`manifest.py`, `train.py`, `evaluate.py`,
`release.py`, `serve_check.py`).

- **Data.** Ten public sets (PlantVillage, PlantDoc, PlantWild, PaddyDoctor,
  TomatoVillage, SAR-CLD-2024 cotton, a sugarcane leaf set, two wheat sets and
  the project's earlier unverified set). 102,318 photographs after cleaning:
  5,267 exact or near duplicates removed (pixel hash and perceptual hash),
  1,623 photographs whose copies carried conflicting labels set aside, 58
  unreadable. Duplicate groups never straddle a split. The PlantDoc test
  folder is kept apart as an external hold-out and was not used for training,
  for choosing the backbone, the epoch or the model.
- **Backbone choice.** Eight ImageNet backbones were compared as frozen
  feature extractors with a logistic regression on top, scored by macro-F1 on
  field validation photographs: ConvNeXt-Tiny 0.607 (27.8 M parameters),
  DenseNet121 0.607 (7.0 M), EfficientNetV2B2 0.604 (8.8 M), EfficientNetV2B3
  0.595, EfficientNetV2S 0.591, EfficientNetV2B0 0.582, MobileNetV3Large
  0.569, ResNet50V2 0.501. The top three are within noise of each other;
  EfficientNetV2B2 was taken because it is a third of ConvNeXt's size, runs
  in the existing LiteRT runtime and continues the v1 family.
- **Training.** Two warm-up epochs on the new classifier head, then 14 epochs
  end to end (cosine schedule, peak rate 3e-4, label smoothing 0.1, mixup
  0.2). Augmentation imitates phone photographs: crops, flips, turns, light,
  colour, JPEG compression and blur. Sampling is class-balanced and gives
  field photographs three times the weight of studio ones. The saved epoch is
  the one with the best macro-F1 on field validation photographs (0.814).
- **Answering rule.** The farmer selects the crop, so only that crop's
  conditions compete. If less than 30 % of the model's belief is on that crop
  the photograph is treated as another plant and gets no answer. Otherwise
  the model answers only at 0.75 confidence or more. The validation rule
  (answers right at least 90 % of the time on field validation photographs)
  would have allowed 0.30; that gave 14.5 confidently wrong answers per 100
  external photographs against 3.4 at 0.75, so the previous release's 0.75
  was kept. This choice was made after seeing the external result, so the
  external answering figures are not a fully blind estimate of it.

## Results

With the crop selected, as the app asks:

| Photographs | Samples | Accuracy (95 % interval) | Macro precision | Macro recall | Macro F1 |
|---|---:|---:|---:|---:|---:|
| Field test (same public sets, held out) | 7,595 | 90.8 % (90.1 to 91.4) | 0.887 | 0.881 | 0.882 |
| Studio test | 8,727 | 99.3 % (99.1 to 99.4) | 0.991 | 0.992 | 0.992 |
| External PlantDoc hold-out | 235 | 85.1 % (80.0 to 89.1) | 0.854 | 0.826 | 0.830 |

With every class competing (no crop given) the external PlantDoc accuracy is
71.9 % (65.9 to 77.3); v1's published figure on that set was 57.2 %.

Like for like, on the photographs both releases can label:

| Photographs | Samples | v1 accuracy / macro F1 | v2 accuracy / macro F1 |
|---|---:|---:|---:|
| External PlantDoc, crop selected | 234 | 75.6 % / 0.752 | 85.5 % / 0.861 |
| External PlantDoc, all classes | 234 | 55.1 % / 0.543 | 72.2 % / 0.749 |
| Field test, crop selected | 1,666 | 64.4 % / 0.640 | 83.1 % / 0.846 |
| Studio test, crop selected | 8,727 | 96.7 % / 0.959 | 99.3 % / 0.992 |

What the farmer sees, measured through the serving path (original
photographs, Pillow decoding, the exported LiteRT artifact, the rule above):

| Photographs | Answered | Right when answering | Confidently wrong per 100 |
|---|---:|---:|---:|
| External PlantDoc (235) | 67.2 % | 94.3 % | 3.8 |
| Field test sample (1,500) | 85.4 % | 96.7 % | 2.8 |
| v1 on external PlantDoc at 0.75 (234) | 73.5 % | 89.0 % | 8.1 |

A photograph offered under the wrong crop was answered 0.2 % of the time on
the field test. Calibration error with the crop selected is 0.010 on the
field test and 0.062 on PlantDoc.

By crop on the field test (accuracy): cotton 99.3 %, sugarcane 99.2 %, rice
95.1 %, wheat 86.9 %, maize 87.2 %, potato 84.4 %, tomato 83.1 %, apple
78.8 %. Weakest conditions (recall): tomato bacterial spot 0.34, wheat leaf
blight 0.48, tomato yellow leaf curl 0.52, wheat tan spot 0.59, apple black
rot 0.61. Per-class figures are in `release.json`.

## What these numbers do not show

- PlantDoc is the only set no part of which was seen in training, and it has
  no rice, wheat, cotton or sugarcane. For those four crops the test
  photographs come from the same public collections as the training
  photographs (different, de-duplicated images), so their figures are likely
  to be higher than on a new farm.
- No photograph in any set was taken by a Krishyak farmer. Validation on
  Indian farm photographs, with labels checked by an agronomist, has not been
  done.
- The earlier `legacy_unverified` set's labels were not independently checked.
- The care steps for the 42 new conditions are drafts awaiting agronomist
  review, like the earlier ones.

The exported artifact (float32 LiteRT, 35.2 MB, built-in operators only)
gives the same top class and the same answer/no-answer decision as the Keras
model on 247 inputs (largest probability difference 2e-6);
`runtime-verification.json` records this. Rollback is a revert of the release
commit, which restores the v1 bundle unchanged.

Photo results include model identity, unsupported/uncertain states and raw score
limitations. Scores are not diagnostic probabilities. Unsupported
crop identity skips inference. No severity, pesticide dose or universal health
score is inferred from a leaf photo or satellite observation.

Farmer feedback is separate from expert corrections. Experts require a fresh
privileged session, current research consent and active class labels; corrections
are audited. Withdrawal immediately removes the image from review/monitoring.
Feedback rates are selected operational evidence, not independent accuracy.
No background retraining or automatic class/checkpoint promotion occurs.

v2 was promoted on the automated evidence above, at the project owner's
instruction to improve the model. The gate below asks for more than that:
blinded expert labels, an independent Indian field test set and a signed
reviewer decision are still open for v2, and its dataset licences are listed
but not legally reviewed.

Release gate: acquisition/license and consent inventory; field/district/crop/
device grouping before splitting; leaf/field duplicate and hash checks; blinded
expert labels; untouched independent test set; per-class balanced accuracy,
macro-F1, sensitivity and abstention/coverage; calibration/domain-shift review;
external comparison; hashed artifacts and signed reviewer decision. Preserve the
prior release for rollback. Failed candidates remain candidates.
