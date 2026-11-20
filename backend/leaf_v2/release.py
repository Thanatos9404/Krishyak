"""Package a trained leaf model as the active release.

Copies the model and its label map into ``models/active`` and writes
``release.json`` from the files the training and evaluation steps produced, so
no number in the release is typed by hand. Run ``export_disease_runtime.py``
afterwards to build and verify the serving artifact.

  python -m leaf_v2.release --run <run dir> --model-id krishyak-leaf-v3 \
      --threshold 0.75 --threshold-note "..." [--mirror --evaluation evaluation_mirror.json]
"""

import argparse
import hashlib
import json
import shutil
from datetime import date
from pathlib import Path

ACTIVE = Path(__file__).resolve().parents[1] / "models" / "active"
KEEP = ("samples", "accuracy", "accuracy_wilson_95", "balanced_accuracy", "macro_precision", "macro_recall", "macro_f1")
# Evaluation set name -> name in the release. "test" and "external_test" keep their earlier meaning.
SETS = {
    "field_test": "test",
    "india_farm_test": "india_farm_test",
    "india_unseen_farms": "india_unseen_farms",
    "studio_test": "studio_test",
    "external_plantdoc_test": "external_test",
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def brief(entry):
    return {key: entry[key] for key in KEEP}


def both(entry):
    """Scores with the crop selected (how the app asks) and with every class competing."""
    return brief(entry["crop_conditioned"]) | {"all_classes": brief(entry["all_classes"])}


def release(args):
    run = args.run
    evaluation = json.loads((run / args.evaluation).read_text(encoding="utf-8"))
    if bool(evaluation.get("mirror_averaging")) != args.mirror:
        raise SystemExit("The evaluation and the release disagree about mirror averaging.")
    training = json.loads((run / "training.json").read_text(encoding="utf-8"))
    audit = json.loads((args.audit or run.parent / "data_audit.json").read_text(encoding="utf-8"))
    probe = json.loads(args.probe.read_text(encoding="utf-8")) if args.probe else None
    for name in ("model.keras", "class_indices.json"):
        shutil.copyfile(run / name, ACTIVE / name)
    labels = json.loads((ACTIVE / "class_indices.json").read_text(encoding="utf-8"))
    sets = {SETS[name]: entry for name, entry in evaluation["sets"].items() if name in SETS}
    previous = evaluation.get("previous_release", {}).get("sets", {})
    if abs(args.threshold - 0.75) < 1e-9:
        at = "answering_at_0.75"
    elif abs(args.threshold - evaluation["threshold"]["value"]) < 1e-9:
        at = "answering_at_threshold"
    else:
        raise SystemExit("The evaluation did not score this threshold; re-run it rather than guessing.")
    body = {
        "model_id": args.model_id,
        "architecture": training["backbone"],
        "input_size": training["input_size"],
        "classes": len(labels),
        "crops": len(evaluation["crops"]),
        "activated_on": date.today().isoformat(),
        "selection": (
            "Best epoch chosen by macro-F1 on field validation photographs; test, external and unseen-farm "
            "photographs were not used to choose the model."
        ),
        "model_sha256": digest(ACTIVE / "model.keras"),
        "class_indices_sha256": digest(ACTIVE / "class_indices.json"),
        "decision": {
            "crop_conditioned": True,
            "threshold": args.threshold,
            "crop_mass_min": evaluation["threshold"]["crop_mass_min"],
            "mirror_averaging": args.mirror,
            "note": args.threshold_note,
        },
        "metrics": {
            "basis": "Top-level figures are with the crop selected, as the app asks; all_classes lets every class compete.",
            **{name: both(entry) for name, entry in sets.items()},
            "answering": {name: entry[at] for name, entry in sets.items()},
            "wrong_crop_answered_share": {
                name: entry["offered_under_another_crop"]["wrongly_answered_share"] for name, entry in sets.items()
            },
            "calibration_error": {name: entry["calibration_error_conditioned"] for name, entry in sets.items()},
            "per_crop": {
                name: sets[name]["per_crop_conditioned"]
                for name in ("test", "india_farm_test", "india_unseen_farms")
                if name in sets
            },
            "per_class_field_test": sets["test"]["crop_conditioned"]["per_class"],
            "by_source_test": {
                name: brief(entry["crop_conditioned"]) for name, entry in evaluation["by_source_test"].items()
            },
            "fit": evaluation["fit"],
            "against_previous_release": {
                SETS.get(name, name): {
                    "photographs_both_models_can_label": entry["photographs_both_models_can_label"],
                    "previous": both(entry["previous"]) | {"answering": entry["previous"]["answering_at_0.75"]},
                    "new": both(entry["new"]) | {"answering": entry["new"]["answering_at_0.75"]},
                }
                for name, entry in previous.items()
            },
        },
        "training": {key: value for key, value in training.items() if key != "history"},
        "learning_curve": [
            {"epoch": row["epoch"], "loss": row["loss"]}
            | {name: row[name]["accuracy"] for name in ("train_field", "field", "lab") if name in row}
            for row in training["history"]
        ],
        "data": audit,
    }
    if probe:
        body["backbone_comparison"] = probe
    (ACTIVE / "release.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: body[k] for k in ("model_id", "architecture", "input_size", "classes", "crops", "decision")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--evaluation", default="evaluation.json")
    parser.add_argument("--audit", type=Path)
    parser.add_argument("--probe", type=Path)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--threshold", type=float, required=True)
    parser.add_argument("--threshold-note", required=True)
    parser.add_argument("--mirror", action="store_true", help="the release averages a photograph with its mirror")
    release(parser.parse_args())
