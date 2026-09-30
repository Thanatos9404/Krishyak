"""Combine raw evaluation shards into one auditable classification report.

Example:
    python combine_evaluation_shards.py --shards evaluation/shards/*.npz
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, classification_report,
    confusion_matrix, f1_score, precision_score, recall_score,
    top_k_accuracy_score,
)

from evaluate_plant_disease_model import DEFAULT_LABELS, load_label_map


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--shards", type=Path, nargs="+", required=True)
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS)
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parent / "evaluation")
    args = parser.parse_args()

    labels = load_label_map(args.labels)
    class_ids = np.arange(len(labels))
    class_names = [labels[index] for index in class_ids]
    chunks = [np.load(path, allow_pickle=False) for path in args.shards]
    y_true = np.concatenate([chunk["y_true"] for chunk in chunks])
    probabilities = np.concatenate([chunk["probabilities"] for chunk in chunks])
    paths = np.concatenate([chunk["paths"] for chunk in chunks])
    if len(set(paths.tolist())) != len(paths):
        raise ValueError("Duplicate image paths found across shards.")
    y_pred = probabilities.argmax(axis=1)

    metrics = {
        "samples": int(len(y_true)),
        "classes": int(len(class_names)),
        "top_1_accuracy": float(accuracy_score(y_true, y_pred)),
        "top_3_accuracy": float(top_k_accuracy_score(y_true, probabilities, k=3, labels=class_ids)),
        "balanced_accuracy": float(balanced_accuracy_score(y_true, y_pred)),
        "precision_macro": float(precision_score(y_true, y_pred, average="macro", zero_division=0)),
        "recall_macro": float(recall_score(y_true, y_pred, average="macro", zero_division=0)),
        "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
        "precision_weighted": float(precision_score(y_true, y_pred, average="weighted", zero_division=0)),
        "recall_weighted": float(recall_score(y_true, y_pred, average="weighted", zero_division=0)),
        "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        "rouge": None,
        "rouge_note": "Not applicable: this is a single-label image classification model, not text generation or summarisation.",
    }
    report = classification_report(y_true, y_pred, labels=class_ids, target_names=class_names, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_true, y_pred, labels=class_ids)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (args.output_dir / "classification_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with (args.output_dir / "confusion_matrix.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual\\predicted", *class_names])
        writer.writerows([[label, *row.tolist()] for label, row in zip(class_names, matrix)])
    with (args.output_dir / "per_image_predictions.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["image_path", "actual_index", "actual_label", "predicted_index", "predicted_label", "confidence"])
        for path, actual, predicted, scores in zip(paths, y_true, y_pred, probabilities):
            writer.writerow([path, int(actual), labels[int(actual)], int(predicted), labels[int(predicted)], float(scores[predicted])])
    print(json.dumps(metrics, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
