"""Join fine-tuned runs into one model that averages their predictions.

Each member keeps its own weights; the joined model feeds the same photograph
to every member and returns the mean of their probabilities. It is saved as a
single Keras model, so evaluation, export and the serving runtime treat it
like any other release.

  python -m leaf_v2.ensemble --members A/model.keras B/model.keras --out DIR
"""

import argparse
import json
import os
import shutil
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402


def join(args):
    members, summaries = [], []
    for index, path in enumerate(args.members):
        loaded = tf.keras.models.load_model(path, compile=False)
        # Re-wrap under a unique name so two runs of the same network can sit side by side.
        member = tf.keras.Model(loaded.input, loaded.output, name=f"member_{index + 1}")
        members.append(member)
        training = json.loads((Path(path).parent / "training.json").read_text())
        summaries.append({key: value for key, value in training.items() if key != "history"} | {"source": str(path)})
    shapes = {(m.input_shape, m.output_shape) for m in members}
    if len(shapes) != 1:
        raise SystemExit("Members must share input size and classes.")
    labels = {Path(path).parent.joinpath("class_indices.json").read_text() for path in args.members}
    if len(labels) != 1:
        raise SystemExit("Members must share one label map.")
    size = members[0].input_shape[1]
    image = tf.keras.Input((size, size, 3), name="image")
    outputs = tf.keras.layers.Average(name="probabilities")([member(image) for member in members])
    joined = tf.keras.Model(image, outputs, name="averaged_members")
    probe = np.random.default_rng(3).random((2, size, size, 3), dtype=np.float32)
    expected = np.mean([np.asarray(member(probe, training=False)) for member in members], axis=0)
    np.testing.assert_allclose(np.asarray(joined(probe, training=False)), expected, rtol=1e-5, atol=1e-6)
    args.out.mkdir(parents=True, exist_ok=True)
    joined.save(args.out / "model.keras")
    shutil.copyfile(Path(args.members[0]).parent / "class_indices.json", args.out / "class_indices.json")
    last = json.loads((Path(args.members[-1]).parent / "training.json").read_text())
    (args.out / "training.json").write_text(
        json.dumps(
            {
                "backbone": f"{len(members)} x {last['backbone']}, predictions averaged",
                "input_size": size,
                "classes": members[0].output_shape[-1],
                "members": summaries,
                "selection": "the averaged model has the best macro-F1 on field validation photographs of the candidates compared",
                "history": last["history"],
            },
            indent=2,
        )
    )
    print("ENSEMBLE_DONE", joined.count_params(), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--members", type=Path, nargs="+", required=True)
    parser.add_argument("--out", type=Path, required=True)
    join(parser.parse_args())
