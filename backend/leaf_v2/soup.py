"""Average the weights of two fine-tuned runs of the same network ("model soup").

Two runs that start from the same ImageNet weights usually end in the same
low-loss basin, so the average of their weights is a valid model, and it tends
to generalise better to photographs from unfamiliar sources than either run.
The mixing weight is chosen on field validation photographs only; test,
external and unseen-farm photographs are not read here.

  python -m leaf_v2.soup --run /root/ml/run3 --cache /root/ml/cache --first A/model.keras --second B/model.keras --out DIR
"""

import argparse
import json
import os
import shutil
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

from .evaluate import condition, summary  # noqa: E402
from .train import eval_dataset, load_manifest  # noqa: E402


def soup(args):
    rows, labels = load_manifest(args.run)
    valid = [r for r in rows if r["split"] == "validation" and r["domain"] != "lab"]
    truth = np.array([r["y"] for r in valid], dtype=int)
    first = tf.keras.models.load_model(args.first, compile=False)
    second = tf.keras.models.load_model(args.second, compile=False)
    a, b = first.get_weights(), second.get_weights()
    if len(a) != len(b) or any(x.shape != y.shape for x, y in zip(a, b, strict=True)):
        raise SystemExit("The two models do not have the same architecture.")
    size = first.input_shape[1]
    data = eval_dataset(valid, args.cache, size, 48)
    results = []
    for share in args.shares:  # share of the second model
        first.set_weights([(1 - share) * x + share * y for x, y in zip(a, b, strict=True)])
        scores = condition(first.predict(data, verbose=0), truth, labels)
        entry = summary(truth, scores, labels)
        results.append({"share_of_second": share, "accuracy": entry["accuracy"], "macro_f1": entry["macro_f1"]})
        print(json.dumps(results[-1]), flush=True)
    best = max(results, key=lambda row: row["macro_f1"])
    share = best["share_of_second"]
    first.set_weights([(1 - share) * x + share * y for x, y in zip(a, b, strict=True)])
    args.out.mkdir(parents=True, exist_ok=True)
    first.save(args.out / "model.keras")
    shutil.copyfile(Path(args.second).parent / "class_indices.json", args.out / "class_indices.json")
    training = json.loads((Path(args.second).parent / "training.json").read_text())
    training["weight_average"] = {
        "first": str(args.first),
        "second": str(args.second),
        "share_of_second": share,
        "chosen_by": "macro-F1 on field validation photographs",
        "candidates": results,
    }
    (args.out / "training.json").write_text(json.dumps(training, indent=2))
    print("SOUP_DONE", json.dumps(best), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--first", type=Path, required=True)
    parser.add_argument("--second", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--shares", type=float, nargs="+", default=[0.0, 0.25, 0.4, 0.5, 0.6, 0.75, 1.0])
    for gpu in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(gpu, True)
    soup(parser.parse_args())
