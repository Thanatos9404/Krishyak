# Leaf-model photographs: where they come from

Every photograph the leaf model trains or is tested on, by source. Counts are
after cleaning (`backend/leaf_v2/manifest.py`): 103,530 photographs kept,
11,220 duplicates removed, 1,623 set aside because copies carried different
labels, 58 unreadable. The datasets themselves are not in the repository;
they sit under the ignored `datasets/` folder.

## Photographs taken on Indian farms

| Source (name in the manifest) | Where | Crop | Photographs | Role | Licence as published |
|---|---|---|---:|---|---|
| Paddy Doctor (`PaddyDoctor`) | Paddy fields near Tirunelveli, Tamil Nadu | Rice, 10 conditions | 10,333 | Train, validation, test | Not re-checked for this page |
| Tomato-Village (`TomatoVillage`) | Villages in Jodhpur and Jaipur districts, Rajasthan | Tomato, 6 conditions | 4,525 | Train, validation, test | Not stated by the publisher |
| Rice Leaf Disease Image Samples (`RiceOdisha`) | Western Odisha (Sambalpur University) | Rice, 4 diseases | 4,752 | Train, validation, test | CC BY 4.0 |
| Sugarcane Leaf Disease Dataset (`SugarcaneLeaf`) | Maharashtra | Sugarcane, 5 conditions | 2,311 | Train, validation, test | CC BY 4.0 |
| Cotton Leaf Disease Dataset with Severity Levels (`CottonPune`) | Pune, Maharashtra | Cotton: bacterial blight, leaf curl, healthy | 933 | Train, validation, test | CC BY 4.0 |
| D-KAP (`AppleKashmir`) | Orchards of the Kashmir valley | Apple: scab, healthy | 205 | Never trained on | DbCL 1.0 |
| Crop Leaf Disease Image Dataset, Jalgaon Region (`Jalgaon`) | Jalgaon, Maharashtra | Cotton: bacterial blight, healthy | 95 | Never trained on | "Other" |

That is 22,854 photographs from documented Indian farms: 16,488 for
training, 2,707 for validation, 3,659 held out for testing, and 300 from two
small sets the model never sees in training.

## Other field photographs

| Source | Where | Crop | Photographs | Licence as published |
|---|---|---|---:|---|
| Wheat Plant Diseases (`WheatPlantDiseases`) | Compiled from several collections; countries not stated | Wheat, 15 conditions | 10,635 | CC0 |
| PlantWild (`PlantWild`) | Web photographs taken outdoors | 12 crops | 8,791 | Not re-checked for this page |
| PlantDoc (`PlantDoc`) | Web photographs assembled at IIT Gandhinagar | 13 crops | 2,520 (226 kept as the external test) | Not re-checked for this page |
| SAR-CLD-2024 (`SAR-CLD-2024`) | Gazipur, Bangladesh | Cotton, 7 conditions | 2,127 | CC BY 4.0 |
| Wheat Leaf Dataset (`WheatLeaf`) | Ethiopia | Wheat, 3 conditions | 100 | Authors' copyright |
| Older repository collection (`legacy_unverified`) | Unknown | Rice, cotton, wheat | 1,919 | Unknown |

## Studio photographs

| Source | Where | Crop | Photographs | Licence as published |
|---|---|---|---:|---|
| PlantVillage (`PlantVillage`) | Leaves photographed on a plain background | 14 crops | 54,284 | Not re-checked for this page |

Licences marked "not re-checked" were not read again from the publisher
while writing this page; the others were read from the publisher's record on
21 November 2026. None has had a legal review.

## What checking the new sources found

- **The older "legacy" rice photographs are the Odisha set.** 5,976 of them are
  the same photographs as the published Odisha rice dataset, so their origin
  is now known. It also means they were already in training before; they are
  not new data.
- **The Odisha rice test is too easy to trust.** The released model scores
  100 % on its 774 held-out photographs. The set is made of tight crops, and
  each disease was photographed in its own style, so a model can tell the
  classes apart without reading the disease. Rice is therefore reported from
  the Tamil Nadu set as well.
- **The Jalgaon maize images are not Jalgaon photographs.** All 100 are copies
  of PlantVillage studio images, so only that set's cotton photographs are
  used. Some of its other images carry the smeared edges of synthetic
  augmentation.
- **A few Jalgaon cotton photographs are not unseen for every model.** 11 of them
  also sit in the older unverified collection, which the first member of the
  released model trained on.
- **A grape set from Nashik was left out.** Its photographs were resized and
  had their backgrounds removed, so they are not raw farm photographs.
- **Label quality varies.** In the Pune cotton set the "mild" leaf-curl and
  wilt photographs look close to healthy leaves, and the Jalgaon "bacterial
  blight" photographs show large pale blotches unlike the small angular spots
  in the Pune set. Nobody with plant-pathology training has checked either.

## What is still missing

No public set of Indian farm photographs was found for wheat, potato or
maize diseases, or for apple and grape beyond the small sets above. For those
crops the model rests on web photographs, studio photographs and wheat data
of unstated origin. The reliable way to close this is photographs from
Krishyak's own farmers, taken in the app with consent and labelled by an
agronomist; the app already records consented photographs and farmer
feedback for that purpose.
