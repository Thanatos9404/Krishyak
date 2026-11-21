"""Compare two models photograph by photograph, and their averaged predictions.

For each set: accuracy and macro-F1 with the crop selected for the first
model, the second model and the average of their probabilities; how often the
app would answer at 0.75 and how often that answer is right; and an exact
McNemar test on the photographs where the two models disagree, so a
difference of a few photographs is not mistaken for an improvement.

  python -m leaf_v2.compare --run /root/ml/run3 --cache /root/ml/cache --first A/model.keras --second B/model.keras
"""

import argparse
import json
import os
from math import comb
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

from .evaluate import condition, predict, selective, summary  # noqa: E402
from .train import load_manifest  # noqa: E402


def mcnemar(first_right, second_right):
    """Two-sided exact test on discordant pairs."""
    only_first = int(np.sum(first_right & ~second_right))
    only_second = int(np.sum(~first_right & second_right))
    n = only_first + only_second
    if n == 0:
        return only_first, only_second, 1.0
    tail = sum(comb(n, k) for k in range(min(only_first, only_second) + 1)) / 2**n
    return only_first, only_second, round(min(1.0, 2 * tail), 4)


def score(truth, raw, labels):
    conditioned, mass = condition(raw, truth, labels, with_mass=True)
    entry = summary(truth, conditioned, labels)
    return (
        {k: entry[k] for k in ("accuracy", "macro_precision", "macro_recall", "macro_f1")}
        | {"answering_at_0.75": selective(truth, conditioned, 0.75, mass)},
        conditioned.argmax(axis=1) == truth,
    )


def compare(args):
    rows, labels = load_manifest(args.run)
    field = [r for r in rows if r["domain"] != "lab"]
    groups = {
        "validation_field": [r for r in field if r["split"] == "validation"],
        "field_test": [r for r in field if r["split"] == "test"],
        "india_farm_test": [r for r in rows if r["split"] == "test" and r.get("india_farm")],
        "india_unseen_farms": [r for r in rows if r["split"] == "external_india" and r.get("india_farm")],
        "external_plantdoc_test": [r for r in rows if r["split"] == "external_test"],
    }
    first = tf.keras.models.load_model(args.first, compile=False)
    second = tf.keras.models.load_model(args.second, compile=False)
    report = {"first": str(args.first), "second": str(args.second), "sets": {}}
    for name, members in groups.items():
        truth = np.array([r["y"] for r in members], dtype=int)
        a = predict(first, members, args.cache, first.input_shape[1])
        b = predict(second, members, args.cache, second.input_shape[1])
        one, one_right = score(truth, a, labels)
        two, two_right = score(truth, b, labels)
        both, _ = score(truth, (a + b) / 2, labels)
        only_first, only_second, p = mcnemar(one_right, two_right)
        report["sets"][name] = {
            "photographs": len(members),
            "first": one,
            "second": two,
            "averaged_predictions": both,
            "only_first_right": only_first,
            "only_second_right": only_second,
            "mcnemar_p": p,
        }
        print(
            f"{name}: n={len(members)} first acc={one['accuracy']} F1={one['macro_f1']} | second acc={two['accuracy']} "
            f"F1={two['macro_f1']} | averaged acc={both['accuracy']} F1={both['macro_f1']} | only first right "
            f"{only_first}, only second right {only_second}, p={p}",
            flush=True,
        )
        print("   answering first", one["answering_at_0.75"], "| second", two["answering_at_0.75"], "| averaged",
              both["answering_at_0.75"], flush=True)
    Path(args.output).write_text(json.dumps(report, indent=2))
    print("COMPARE_DONE", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--first", type=Path, required=True)
    parser.add_argument("--second", type=Path, required=True)
    parser.add_argument("--output", required=True)
    for gpu in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(gpu, True)
    compare(parser.parse_args())
