"""Appraise a leaf model on held-out photographs, the way the app uses it.

Reports, for every test set (field photographs, studio photographs, the
untouched PlantDoc field hold-out and each source on its own):

* accuracy with a Wilson 95 % interval, balanced accuracy (macro recall),
  macro precision, macro F1 and top-3 accuracy;
* the same when the prediction is limited to the crop the farmer selected,
  which is how the app asks the model;
* per-class precision, recall and F1;
* calibration error, and what share of photographs the model answers and how
  often those answers are right at the confidence threshold. The threshold is
  chosen on validation photographs only.

With ``--baseline`` the previous release is scored on the photographs both
models can label, so the improvement is measured like for like.

  python -m leaf_v2.evaluate --run /root/ml/run --cache /root/ml/cache --model /root/ml/run/X/model.keras
"""

import argparse
import json
import math
import os
from collections import defaultdict
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

from .train import eval_dataset, load_manifest  # noqa: E402

TARGET_SELECTIVE_ACCURACY = 0.9
# Below this share of the model's belief on the selected crop, the photograph is treated as
# not showing that crop and no answer is given. The API applies the same rule.
CROP_MASS_MIN = 0.3


def crop_of(label):
    return label.split("___")[0]


def wilson(correct, total, z=1.96):
    if total == 0:
        return [0.0, 0.0]
    p = correct / total
    centre = (p + z * z / (2 * total)) / (1 + z * z / total)
    half = z * math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / (1 + z * z / total)
    return [round(centre - half, 4), round(centre + half, 4)]


def per_class(truth, predicted, labels):
    rows = {}
    for index, name in enumerate(labels):
        support = int(np.sum(truth == index))
        if support == 0:
            continue
        tp = int(np.sum((truth == index) & (predicted == index)))
        guessed = int(np.sum(predicted == index))
        precision = tp / guessed if guessed else 0.0
        recall = tp / support
        f1 = 0.0 if precision + recall == 0 else 2 * precision * recall / (precision + recall)
        rows[name] = {"precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4), "support": support}
    return rows


def summary(truth, probabilities, labels, detail=False):
    predicted = np.argmax(probabilities, axis=1)
    classes = per_class(truth, predicted, labels)
    correct = int(np.sum(truth == predicted))
    top3 = np.argsort(probabilities, axis=1)[:, -3:]
    weights = np.array([row["support"] for row in classes.values()], float)
    result = {
        "samples": int(len(truth)),
        "accuracy": round(correct / len(truth), 4),
        "accuracy_wilson_95": wilson(correct, len(truth)),
        "balanced_accuracy": round(float(np.mean([row["recall"] for row in classes.values()])), 4),
        "macro_precision": round(float(np.mean([row["precision"] for row in classes.values()])), 4),
        "macro_recall": round(float(np.mean([row["recall"] for row in classes.values()])), 4),
        "macro_f1": round(float(np.mean([row["f1"] for row in classes.values()])), 4),
        "weighted_f1": round(float(np.average([row["f1"] for row in classes.values()], weights=weights)), 4),
        "top3_accuracy": round(float(np.mean([truth[i] in top3[i] for i in range(len(truth))])), 4),
        "classes_present": len(classes),
    }
    if detail:
        result["per_class"] = classes
    return result


def condition(probabilities, selected, labels, with_mass=False):
    """Keep only classes of the selected crop (given as any class index of it), renormalised."""
    crops = np.array([crop_of(name) for name in labels])
    mask = crops[None, :] == crops[selected][:, None]
    kept = probabilities * mask
    mass = kept.sum(axis=1)
    conditioned = kept / np.maximum(mass[:, None], 1e-12)
    return (conditioned, mass) if with_mass else conditioned


def per_crop(truth, predicted, labels):
    crops = np.array([crop_of(name) for name in labels])
    rows = {}
    for crop in sorted(set(crops[truth])):
        inside = crops[truth] == crop
        classes = per_class(truth[inside], predicted[inside], labels)
        rows[crop] = {
            "samples": int(inside.sum()),
            "accuracy": round(float((truth[inside] == predicted[inside]).mean()), 4),
            "macro_recall": round(float(np.mean([row["recall"] for row in classes.values()])), 4),
            "macro_f1": round(float(np.mean([row["f1"] for row in classes.values()])), 4),
            "classes": len(classes),
        }
    return rows


def wrong_crop(probabilities, truth, labels, threshold):
    """Photographs offered under a different crop than they show: how many still get an answer."""
    crops = [crop_of(name) for name in labels]
    names = sorted(set(crops))
    first = {crop: crops.index(crop) for crop in names}
    other = np.array([first[names[(names.index(crops[t]) + 1 + i % (len(names) - 1)) % len(names)]] for i, t in enumerate(truth)])
    conditioned, mass = condition(probabilities, other, labels, with_mass=True)
    answered = (conditioned.max(axis=1) >= threshold) & (mass >= CROP_MASS_MIN)
    return {"samples": int(len(truth)), "wrongly_answered_share": round(float(answered.mean()), 4)}


def calibration_error(truth, probabilities, bins=15):
    confidence, predicted = probabilities.max(axis=1), probabilities.argmax(axis=1)
    edges, total = np.linspace(0, 1, bins + 1), 0.0
    for low, high in zip(edges[:-1], edges[1:], strict=True):
        inside = (confidence > low) & (confidence <= high)
        if inside.any():
            total += inside.mean() * abs((predicted[inside] == truth[inside]).mean() - confidence[inside].mean())
    return round(float(total), 4)


def selective(truth, probabilities, threshold, mass=None):
    confidence, predicted = probabilities.max(axis=1), probabilities.argmax(axis=1)
    answered = confidence >= threshold
    if mass is not None:
        answered &= mass >= CROP_MASS_MIN
    wrong = answered & (predicted != truth)
    return {
        "threshold": round(float(threshold), 3),
        "coverage": round(float(answered.mean()), 4),
        "accuracy_when_answering": round(float((predicted[answered] == truth[answered]).mean()), 4) if answered.any() else None,
        "confident_wrong_per_100_photos": round(float(wrong.mean() * 100), 2),
    }


def choose_threshold(truth, probabilities, mass=None):
    """Lowest threshold whose answers are right at least 90 % of the time on validation."""
    for threshold in np.arange(0.30, 0.991, 0.01):
        result = selective(truth, probabilities, threshold, mass)
        if result["accuracy_when_answering"] is not None and result["accuracy_when_answering"] >= TARGET_SELECTIVE_ACCURACY:
            return float(round(threshold, 2))
    return 0.99


def predict(model, rows, cache, size, tta=False):
    if not rows:
        return np.zeros((0, model.output_shape[-1]), np.float32)
    scores = model.predict(eval_dataset(rows, cache, size, 48), verbose=0)
    if tta:
        # The same photograph mirrored; the two answers are averaged, as the API does.
        mirrored = eval_dataset(rows, cache, size, 48).map(tf.image.flip_left_right)
        scores = (scores + model.predict(mirrored, verbose=0)) / 2
    return scores


def sample(rows, count, seed=5):
    order = np.random.default_rng(seed).permutation(len(rows))[:count]
    return [rows[i] for i in order]


def block(truth, raw, labels, threshold, detail=False):
    conditioned, mass = condition(raw, truth, labels, with_mass=True)
    return {
        "all_classes": summary(truth, raw, labels),
        "crop_conditioned": summary(truth, conditioned, labels, detail=detail),
        "per_crop_conditioned": per_crop(truth, conditioned.argmax(axis=1), labels),
        "calibration_error_conditioned": calibration_error(truth, conditioned),
        "answering_at_threshold": selective(truth, conditioned, threshold, mass),
        "answering_at_0.75": selective(truth, conditioned, 0.75, mass),
        "offered_under_another_crop": wrong_crop(raw, truth, labels, threshold),
    }


REPORTED = ("field_test", "india_farm_test", "india_unseen_farms", "studio_test", "external_plantdoc_test")
FIT = ("train_field_sample", "validation_field", "field_test", "train_studio_sample", "studio_test")


def evaluate(args):
    rows, labels = load_manifest(args.run)
    model = tf.keras.models.load_model(args.model, compile=False)
    size = model.input_shape[1]
    field = [r for r in rows if r["domain"] != "lab"]
    groups = {
        "validation_field": [r for r in field if r["split"] == "validation"],
        "field_test": [r for r in field if r["split"] == "test"],
        "studio_test": [r for r in rows if r["split"] == "test" and r["domain"] == "lab"],
        "external_plantdoc_test": [r for r in rows if r["split"] == "external_test"],
        # Photographs taken on Indian farms: held-out photographs of sources the model trains on,
        # and whole sources it never sees.
        "india_farm_test": [r for r in rows if r["split"] == "test" and r.get("india_farm")],
        "india_unseen_farms": [r for r in rows if r["split"] == "external_india" and r.get("india_farm")],
        # Unaugmented training photographs, to compare with held-out ones.
        "train_field_sample": sample([r for r in field if r["split"] == "train"], 4000),
        "train_studio_sample": sample([r for r in rows if r["split"] == "train" and r["domain"] == "lab"], 2000),
    }
    for source in args.unseen_sources or []:
        # Every photograph of a source this model was never trained on, whatever split it now has.
        groups[f"unseen_source_{source}"] = [r for r in rows if r["source"] == source]
    by_source = defaultdict(list)
    for row in rows:
        if row["split"] == "test":
            by_source[row["source"]].append(row)
    outputs = {name: predict(model, members, args.cache, size, args.tta) for name, members in groups.items()}
    truths = {name: np.array([r["y"] for r in members], dtype=int) for name, members in groups.items()}

    validation, validation_mass = condition(
        outputs["validation_field"], truths["validation_field"], labels, with_mass=True
    )
    threshold = choose_threshold(truths["validation_field"], validation, validation_mass)
    report = {
        "model": str(args.model),
        "input_size": size,
        "mirror_averaging": bool(args.tta),
        "classes": len(labels),
        "crops": sorted({crop_of(name) for name in labels}),
        "threshold": {
            "value": threshold,
            "crop_mass_min": CROP_MASS_MIN,
            "rule": f"lowest confidence at which crop-conditioned answers are right at least "
                    f"{int(TARGET_SELECTIVE_ACCURACY * 100)} % of the time on field validation photographs",
        },
        "sets": {},
    }
    reported = [*REPORTED, *(name for name in groups if name.startswith("unseen_source_"))]
    for name in reported:
        if len(truths[name]):
            report["sets"][name] = block(truths[name], outputs[name], labels, threshold, detail=name != "studio_test")
    # Does the model do much better on photographs it trained on than on ones it did not?
    fit = {}
    for name in FIT:
        entry = summary(truths[name], condition(outputs[name], truths[name], labels), labels)
        fit[name] = {k: entry[k] for k in ("samples", "accuracy", "macro_f1")}
    report["fit"] = fit | {
        "field_gap_train_minus_test_accuracy": round(
            fit["train_field_sample"]["accuracy"] - fit["field_test"]["accuracy"], 4
        ),
        "field_gap_validation_minus_test_accuracy": round(
            fit["validation_field"]["accuracy"] - fit["field_test"]["accuracy"], 4
        ),
        "studio_gap_train_minus_test_accuracy": round(
            fit["train_studio_sample"]["accuracy"] - fit["studio_test"]["accuracy"], 4
        ),
        "note": "Crop selected; training photographs are scored without augmentation.",
    }
    report["by_source_test"] = {}
    for source, members in sorted(by_source.items()):
        truth = np.array([r["y"] for r in members])
        raw = predict(model, members, args.cache, size, args.tta)
        report["by_source_test"][source] = {
            "all_classes": summary(truth, raw, labels),
            "crop_conditioned": summary(truth, condition(raw, truth, labels), labels),
        }

    if args.baseline:
        old = tf.keras.models.load_model(args.baseline, compile=False)
        old_labels_map = json.loads(Path(args.baseline_labels).read_text())
        old_labels = [old_labels_map[str(i)] for i in range(len(old_labels_map))]
        shared = [name for name in old_labels if name in labels]
        report["previous_release"] = {"model": str(args.baseline), "classes": len(old_labels), "sets": {}}
        for name in reported:
            members = [r for r in groups[name] if r["label"] in shared]
            if not members:
                continue
            truth_old = np.array([old_labels.index(r["label"]) for r in members])
            truth_new = np.array([r["y"] for r in members])
            old_raw = predict(old, members, args.cache, old.input_shape[1])
            new_raw = predict(model, members, args.cache, size, args.tta)
            old_conditioned, old_mass = condition(old_raw, truth_old, old_labels, with_mass=True)
            new_conditioned, new_mass = condition(new_raw, truth_new, labels, with_mass=True)
            report["previous_release"]["sets"][name] = {
                "photographs_both_models_can_label": len(members),
                "previous": {
                    "all_classes": summary(truth_old, old_raw, old_labels),
                    "crop_conditioned": summary(truth_old, old_conditioned, old_labels),
                    "answering_at_0.75": selective(truth_old, old_conditioned, 0.75, old_mass),
                },
                "new": {
                    "all_classes": summary(truth_new, new_raw, labels),
                    "crop_conditioned": summary(truth_new, new_conditioned, labels),
                    "answering_at_0.75": selective(truth_new, new_conditioned, 0.75, new_mass),
                },
            }
    output = Path(args.output or Path(args.model).parent / "evaluation.json")
    output.write_text(json.dumps(report, indent=2))
    for name, entry in report["sets"].items():
        cond, every = entry["crop_conditioned"], entry["all_classes"]
        print(
            f"{name}: n={cond['samples']} crop-selected acc={cond['accuracy']} P={cond['macro_precision']} "
            f"R={cond['macro_recall']} F1={cond['macro_f1']} | all-classes acc={every['accuracy']} | "
            f"at 0.75: {entry['answering_at_0.75']}"
        )
    print("fit:", json.dumps(report["fit"]))
    for source, entry in report["by_source_test"].items():
        cond = entry["crop_conditioned"]
        print("  source", source, cond["samples"], cond["accuracy"], cond["macro_f1"])
    if args.baseline:
        for name, entry in report["previous_release"]["sets"].items():
            print(
                "like-for-like", name, entry["photographs_both_models_can_label"],
                "previous", entry["previous"]["crop_conditioned"]["accuracy"],
                entry["previous"]["crop_conditioned"]["macro_f1"],
                "new", entry["new"]["crop_conditioned"]["accuracy"], entry["new"]["crop_conditioned"]["macro_f1"],
            )
    print("EVALUATION_DONE", output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--baseline-labels", type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--tta", action="store_true", help="average each photograph with its mirror image")
    parser.add_argument("--unseen-sources", nargs="*", help="sources this model never trained on; scored in full")
    for gpu in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(gpu, True)
    evaluate(parser.parse_args())
