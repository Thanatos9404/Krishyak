"""Score the active release through the real serving path.

Training and evaluation read cached, pre-resized photographs with TensorFlow.
The API instead decodes the original upload with Pillow and runs the exported
LiteRT artifact. This sends original photographs through
``model_inference.predict_from_image`` exactly as the API does, with the crop
selected, so any gap between the two pipelines is measured rather than assumed.

  KRISHYAK_DISEASE_RUNTIME=litert python -m leaf_v2.serve_check --run /root/ml/run --datasets ../datasets
"""

import argparse
import json
import os
import time
from collections import defaultdict
from pathlib import Path

import numpy as np


def check(args):
    import model_inference as inference

    rows = json.loads((args.run / "manifest.json").read_text())
    rng = np.random.default_rng(11)
    groups = {
        "external_plantdoc_test": [r for r in rows if r["split"] == "external_test"],
        "field_test_sample": [r for r in rows if r["split"] == "test" and r["domain"] != "lab"],
    }
    sample = groups["field_test_sample"]
    groups["field_test_sample"] = [sample[i] for i in rng.permutation(len(sample))[: args.sample]]
    report = {
        "runtime": os.getenv("KRISHYAK_DISEASE_RUNTIME", "auto"),
        "model_id": inference.get_model_identity(),
        "note": "Original photographs through predict_from_image with the LiteRT artifact, crop selected, release decision rule applied.",
        "sets": {},
    }
    for name, members in groups.items():
        tally, seconds = defaultdict(int), []
        for row in members:
            data = (args.datasets / row["path"]).read_bytes()
            started = time.perf_counter()
            result = inference.predict_from_image(data, inference.class_crop(row["label"]))
            seconds.append(time.perf_counter() - started)
            tally["photos"] += 1
            tally["status_" + result["status"]] += 1
            top = (result.get("top_predictions") or [{}])[0].get("class")
            if result["status"] in {"disease_detected", "healthy"}:
                tally["answered"] += 1
                tally["answered_right"] += top == row["label"]
        photos, answered = tally["photos"], tally["answered"]
        report["sets"][name] = {
            "photos": photos,
            "coverage": round(answered / photos, 4),
            "accuracy_when_answering": round(tally["answered_right"] / answered, 4) if answered else None,
            "confident_wrong_per_100_photos": round((answered - tally["answered_right"]) / photos * 100, 2),
            "statuses": {k[7:]: v for k, v in tally.items() if k.startswith("status_")},
            "median_seconds_per_photo": round(float(np.median(seconds)), 3),
        }
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--datasets", type=Path, required=True)
    parser.add_argument("--sample", type=int, default=1500)
    parser.add_argument("--output", default="models/active/serving-check.json")
    check(parser.parse_args())
