"""Package a trained leaf model as the active release.

Copies the model and its label map into ``models/active`` and writes
``release.json`` from the files the training and evaluation steps produced, so
no number in the release is typed by hand. Run ``export_disease_runtime.py``
afterwards to build and verify the serving artifact.

  python -m leaf_v2.release --run <run dir> --model-id krishyak-leaf-v2 \
      --threshold 0.75 --threshold-note "..."
"""

import argparse
import hashlib
import json
import shutil
from datetime import date
from pathlib import Path

ACTIVE = Path(__file__).resolve().parents[1] / "models" / "active"
KEEP = ("samples", "accuracy", "accuracy_wilson_95", "balanced_accuracy", "macro_precision", "macro_recall", "macro_f1")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def brief(entry):
    return {key: entry[key] for key in KEEP}


def both(entry):
    """Scores with the crop selected (how the app asks) and with every class competing."""
    return brief(entry["crop_conditioned"]) | {"all_classes": brief(entry["all_classes"])}


def release(args):
    run = args.run
    evaluation = json.loads((run / "evaluation.json").read_text(encoding="utf-8"))
    training = json.loads((run / "training.json").read_text(encoding="utf-8"))
    audit = json.loads((args.audit or run.parent / "data_audit.json").read_text(encoding="utf-8"))
    probe = json.loads((args.probe or run.parent / "backbone_probe.json").read_text(encoding="utf-8"))
    for name in ("model.keras", "class_indices.json"):
        shutil.copyfile(run / name, ACTIVE / name)
    labels = json.loads((ACTIVE / "class_indices.json").read_text(encoding="utf-8"))
    sets = evaluation["sets"]
    previous = evaluation.get("previous_release", {}).get("sets", {})
    at = f"answering_at_{args.threshold}" if f"answering_at_{args.threshold}" in sets["field_test"] else None
    if at is None and abs(args.threshold - evaluation["threshold"]["value"]) < 1e-9:
        at = "answering_at_threshold"
    if at is None:
        raise SystemExit("The evaluation did not score this threshold; re-run it rather than guessing.")
    body = {
        "model_id": args.model_id,
        "architecture": training["backbone"],
        "input_size": training["input_size"],
        "classes": len(labels),
        "crops": len(evaluation["crops"]),
        "activated_on": date.today().isoformat(),
        "selection": (
            "Backbone chosen by a frozen-feature comparison on field validation photographs; best epoch chosen by "
            "field-validation macro-F1; test and external photographs were not used for either choice."
        ),
        "model_sha256": digest(ACTIVE / "model.keras"),
        "class_indices_sha256": digest(ACTIVE / "class_indices.json"),
        "decision": {
            "crop_conditioned": True,
            "threshold": args.threshold,
            "crop_mass_min": evaluation["threshold"]["crop_mass_min"],
            "note": args.threshold_note,
        },
        "metrics": {
            "basis": "Top-level figures are with the crop selected, as the app asks; all_classes lets every class compete.",
            "test": both(sets["field_test"]),
            "studio_test": both(sets["studio_test"]),
            "external_test": both(sets["external_plantdoc_test"]),
            "answering": {name: entry[at] for name, entry in sets.items()},
            "wrong_crop_answered_share": {
                name: entry["offered_under_another_crop"]["wrongly_answered_share"] for name, entry in sets.items()
            },
            "calibration_error": {name: entry["calibration_error_conditioned"] for name, entry in sets.items()},
            "per_crop_field_test": sets["field_test"]["per_crop_conditioned"],
            "per_class_field_test": sets["field_test"]["crop_conditioned"]["per_class"],
            "by_source_test": {
                name: brief(entry["crop_conditioned"]) for name, entry in evaluation["by_source_test"].items()
            },
            "against_previous_release": {
                name: {
                    "photographs_both_models_can_label": entry["photographs_both_models_can_label"],
                    "previous": both(entry["previous"]),
                    "new": both(entry["new"]),
                }
                for name, entry in previous.items()
            },
        },
        "training": {
            key: training[key]
            for key in (
                "train_images",
                "batch",
                "steps_per_epoch",
                "warmup_epochs",
                "epochs",
                "peak_learning_rate",
                "selection",
                "best_field_macro_f1",
                "augmentation",
                "sampling",
            )
        },
        "data": audit,
        "backbone_comparison": probe,
    }
    (ACTIVE / "release.json").write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: body[k] for k in ("model_id", "architecture", "input_size", "classes", "crops", "decision")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--audit", type=Path)
    parser.add_argument("--probe", type=Path)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--threshold", type=float, required=True)
    parser.add_argument("--threshold-note", required=True)
    release(parser.parse_args())
