"""Evaluate Krishyak's 42-class Keras disease classifier on labelled images.

Example (from backend/, with the project virtual environment):
    .\\venv\\Scripts\\python.exe -m pip install -r requirements-eval.txt
    .\\venv\\Scripts\\python.exe evaluate_plant_disease_model.py

The evaluator deliberately refuses unlabelled folders.  It writes all evidence
needed to substantiate a model claim: metrics.json, classification_report.json,
confusion_matrix.csv, and per_image_predictions.csv.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import numpy as np


ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL = ROOT / "models" / "plant_disease_model.h5"
DEFAULT_LABELS = ROOT / "models" / "class_indices.json"
DEFAULT_DATASET = ROOT.parent / "datasets" / "pdisease" / "Validation"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".gif", ".tif", ".tiff"}


def normalise_label(value: str) -> str:
    """Compare labels robustly across case, spaces and underscore differences."""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def load_label_map(path: Path) -> Dict[int, str]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    try:
        labels = {int(index): str(label) for index, label in raw.items()}
    except (AttributeError, ValueError) as exc:
        raise ValueError(f"Invalid class-index JSON: {path}") from exc
    expected = list(range(len(labels)))
    if sorted(labels) != expected:
        raise ValueError("Class indices must be contiguous and start at 0.")
    return labels


def discover_samples(dataset: Path, labels: Dict[int, str]) -> List[Tuple[Path, int]]:
    """Build a labelled manifest without relying on directory sort order."""
    lookup = {normalise_label(name): index for index, name in labels.items()}
    samples: List[Tuple[Path, int]] = []
    unknown_dirs: List[str] = []
    found_indices = set()

    for class_dir in sorted(path for path in dataset.iterdir() if path.is_dir()):
        index = lookup.get(normalise_label(class_dir.name))
        if index is None:
            unknown_dirs.append(class_dir.name)
            continue
        images = sorted(
            path for path in class_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        )
        if images:
            found_indices.add(index)
            samples.extend((image, index) for image in images)

    if unknown_dirs:
        raise ValueError(
            "Dataset directories without a model label: " + ", ".join(unknown_dirs)
        )
    missing = [labels[index] for index in labels if index not in found_indices]
    if missing:
        raise ValueError("No images found for model classes: " + ", ".join(missing))
    if not samples:
        raise ValueError(f"No images were found in {dataset}")
    return samples


def image_batches(samples: List[Tuple[Path, int]], batch_size: int, image_size: Tuple[int, int]) -> Iterable[Tuple[np.ndarray, np.ndarray, List[Path]]]:
    from PIL import Image

    for start in range(0, len(samples), batch_size):
        batch = samples[start:start + batch_size]
        images = []
        for path, _ in batch:
            with Image.open(path) as image:
                image = image.convert("RGB").resize(image_size)
                images.append(np.asarray(image, dtype=np.float32) / 255.0)
        yield np.stack(images), np.asarray([label for _, label in batch]), [path for path, _ in batch]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS)
    parser.add_argument("--dataset", type=Path, default=DEFAULT_DATASET)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "evaluation")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--start-image", type=int, default=0, help="Zero-based start within the deterministic manifest.")
    parser.add_argument("--max-images", type=int, help="Maximum number of manifest images to evaluate.")
    parser.add_argument("--save-shard", type=Path, help="Write raw predictions to an .npz shard instead of final metrics.")
    args = parser.parse_args()

    try:
        import tensorflow as tf
        from sklearn.metrics import (
            accuracy_score, balanced_accuracy_score, classification_report,
            confusion_matrix, f1_score, precision_score, recall_score,
            top_k_accuracy_score,
        )
    except ImportError as exc:
        print(
            "Missing evaluation dependency. Use Python 3.11, then run: "
            "python -m pip install -r requirements-eval.txt",
            file=sys.stderr,
        )
        raise SystemExit(2) from exc

    if args.batch_size <= 0:
        raise ValueError("--batch-size must be positive")
    for path, description in ((args.model, "model"), (args.labels, "label map"), (args.dataset, "dataset")):
        if not path.exists():
            raise FileNotFoundError(f"{description.capitalize()} not found: {path}")

    labels = load_label_map(args.labels)
    samples = discover_samples(args.dataset, labels)
    if args.start_image < 0:
        raise ValueError("--start-image cannot be negative")
    end_image = len(samples) if args.max_images is None else args.start_image + args.max_images
    samples = samples[args.start_image:end_image]
    if not samples:
        raise ValueError("The selected shard contains no images.")
    model = tf.keras.models.load_model(args.model, compile=False)
    input_shape = model.input_shape
    output_shape = model.output_shape
    if len(input_shape) != 4 or input_shape[-1] != 3:
        raise ValueError(f"Expected RGB image model; got input shape {input_shape}")
    if output_shape[-1] != len(labels):
        raise ValueError(
            f"Model outputs {output_shape[-1]} classes but class_indices.json has {len(labels)}."
        )
    image_size = (int(input_shape[2]), int(input_shape[1]))  # PIL uses width, height

    true_parts, probability_parts, saved_paths = [], [], []
    total_batches = (len(samples) + args.batch_size - 1) // args.batch_size
    print(f"Evaluating {len(samples)} images in {total_batches} batches...", flush=True)
    for batch_number, (images, y_batch, paths) in enumerate(
        image_batches(samples, args.batch_size, image_size), start=1
    ):
        probabilities = model.predict(images, verbose=0)
        true_parts.append(y_batch)
        probability_parts.append(probabilities)
        saved_paths.extend(paths)
        if batch_number == 1 or batch_number % 10 == 0 or batch_number == total_batches:
            print(f"Completed batch {batch_number}/{total_batches}", flush=True)

    y_true = np.concatenate(true_parts)
    probabilities = np.concatenate(probability_parts)
    y_pred = probabilities.argmax(axis=1)
    if args.save_shard:
        args.save_shard.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(
            args.save_shard,
            y_true=y_true,
            probabilities=probabilities,
            paths=np.asarray([str(path.resolve()) for path in saved_paths]),
        )
        print(f"Saved {len(y_true)} predictions to {args.save_shard.resolve()}")
        return 0
    class_ids = np.arange(len(labels))
    class_names = [labels[index] for index in class_ids]

    metrics = {
        "dataset": str(args.dataset.resolve()),
        "model": str(args.model.resolve()),
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
    report = classification_report(
        y_true, y_pred, labels=class_ids, target_names=class_names,
        output_dict=True, zero_division=0,
    )
    matrix = confusion_matrix(y_true, y_pred, labels=class_ids)

    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    (args.output_dir / "classification_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with (args.output_dir / "confusion_matrix.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual\\predicted", *class_names])
        for label, row in zip(class_names, matrix):
            writer.writerow([label, *row.tolist()])
    with (args.output_dir / "per_image_predictions.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["image_path", "actual_index", "actual_label", "predicted_index", "predicted_label", "confidence"])
        for path, actual, predicted, scores in zip(saved_paths, y_true, y_pred, probabilities):
            writer.writerow([path, int(actual), labels[int(actual)], int(predicted), labels[int(predicted)], float(scores[predicted])])

    print(json.dumps(metrics, indent=2))
    print(f"Evidence saved to {args.output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
