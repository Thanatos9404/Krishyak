"""Leaf-model v2 training: backbone selection, then fine-tuning of the winner.

  probe     Compare ImageNet backbones as frozen feature extractors: pooled
            features -> logistic regression, scored on *field* validation
            photographs. Picks the architecture on evidence, not habit.
  finetune  Train the chosen backbone end to end with field-style augmentation,
            class- and domain-balanced sampling, label smoothing and mixup.
            The best epoch is chosen by field-validation macro-F1 only; test
            splits are never read here.

The model takes RGB in [0, 1] squashed to SIZE x SIZE, exactly what the API
feeds it, so there is no train/serve preprocessing skew.

  python -m leaf_v2.train probe    --run /root/ml/run --cache /root/ml/cache
  python -m leaf_v2.train finetune --run /root/ml/run --cache /root/ml/cache --backbone EfficientNetV2S --size 320
"""

import argparse
import json
import math
import os
import time
from collections import Counter
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

BACKBONES = {
    # name: (constructor path, feeds on 0-255 input with built-in preprocessing)
    "MobileNetV3Large": "MobileNetV3Large",
    "EfficientNetV2B0": "EfficientNetV2B0",
    "EfficientNetV2B2": "EfficientNetV2B2",
    "EfficientNetV2B3": "EfficientNetV2B3",
    "EfficientNetV2S": "EfficientNetV2S",
    "ConvNeXtTiny": "ConvNeXtTiny",
    "DenseNet121": "DenseNet121",
    "ResNet50V2": "ResNet50V2",
}
AUTOTUNE = tf.data.AUTOTUNE


def backbone(name, size):
    """ImageNet backbone taking [0, 1] RGB; every family's own scaling is applied inside."""
    inputs = tf.keras.Input((size, size, 3), name="image")
    scaled = tf.keras.layers.Rescaling(255.0, name="to_255")(inputs)
    apps = tf.keras.applications
    if name == "DenseNet121":
        scaled = tf.keras.layers.Lambda(apps.densenet.preprocess_input, name="densenet_scale")(scaled)
    if name == "ResNet50V2":
        scaled = tf.keras.layers.Rescaling(1 / 127.5, offset=-1, name="resnet_scale")(scaled)
    base = getattr(apps, BACKBONES[name])(include_top=False, weights="imagenet", input_shape=(size, size, 3), pooling="avg")
    return inputs, base(scaled), base


def load_manifest(run):
    rows = json.loads((run / "manifest.json").read_text())
    labels = json.loads((run / "class_indices.json").read_text())
    index = {name: int(i) for i, name in labels.items()}
    for row in rows:
        row["y"] = index[row["label"]]
    return rows, [labels[str(i)] for i in range(len(labels))]


def decode(path, size, training):
    image = tf.io.decode_jpeg(tf.io.read_file(path), channels=3)
    if training:
        # A leaf photographed from further away, off-centre, or partly cropped.
        shape = tf.shape(image)
        box = tf.image.sample_distorted_bounding_box(
            shape, tf.zeros((1, 0, 4)), area_range=(0.3, 1.0), aspect_ratio_range=(0.7, 1.4), max_attempts=10,
            use_image_if_no_bounding_boxes=True,
        )
        image = tf.slice(image, box[0], box[1])
    image = tf.image.resize(image, (size, size), method="bilinear", antialias=True)
    image = tf.cast(image, tf.float32) / 255.0
    image.set_shape((size, size, 3))
    return image


def augment(image):
    """Phone-photo conditions: any orientation, harsh or dull light, colour casts, blur, compression."""
    image = tf.image.random_flip_left_right(image)
    image = tf.image.random_flip_up_down(image)
    image = tf.image.rot90(image, tf.random.uniform((), 0, 4, tf.int32))
    image = tf.image.random_brightness(image, 0.25)
    image = tf.image.random_contrast(image, 0.65, 1.4)
    image = tf.image.random_saturation(image, 0.6, 1.5)
    image = tf.image.random_hue(image, 0.04)
    image = tf.clip_by_value(image, 0.0, 1.0)
    quality = tf.random.uniform((), 35, 100, tf.int32)
    image = tf.cond(
        tf.random.uniform(()) < 0.4,
        lambda: tf.cast(tf.image.adjust_jpeg_quality(image, quality), tf.float32),
        lambda: image,
    )

    def blur():
        small = tf.image.resize(image, tf.shape(image)[:2] // 2, method="area")
        return tf.image.resize(small, tf.shape(image)[:2], method="bilinear")

    image = tf.cond(tf.random.uniform(()) < 0.15, blur, lambda: image)
    return tf.clip_by_value(image, 0.0, 1.0)


def mix(images, labels, alpha=0.2, probability=0.6):
    """Mixup on a batch: softer targets, less memorising of studio backgrounds."""
    batch = tf.shape(images)[0]
    # Beta(alpha, alpha) from two gamma draws; the same first draw must sit in the denominator.
    first, second = tf.random.gamma((batch,), alpha), tf.random.gamma((batch,), alpha)
    lam = tf.clip_by_value(first / (first + second + 1e-8), 0.0, 1.0)
    lam = tf.where(tf.random.uniform((batch,)) < probability, tf.maximum(lam, 1 - lam), 1.0)
    order = tf.random.shuffle(tf.range(batch))
    image_lam = tf.reshape(lam, (-1, 1, 1, 1))
    label_lam = tf.reshape(lam, (-1, 1))
    return (
        images * image_lam + tf.gather(images, order) * (1 - image_lam),
        labels * label_lam + tf.gather(labels, order) * (1 - label_lam),
    )


def eval_dataset(rows, cache, size, batch):
    paths = [str(cache / row["cache"]) for row in rows]
    data = tf.data.Dataset.from_tensor_slices(paths)
    return data.map(lambda p: decode(p, size, False), AUTOTUNE).batch(batch).prefetch(AUTOTUNE)


def sampling_weights(rows, field_weight=3.0):
    """Balance classes (square-root damped) and give field photographs more pull than studio ones."""
    counts = Counter(row["y"] for row in rows)
    weights = np.array(
        [(1.0 / math.sqrt(counts[row["y"]])) * (field_weight if row["domain"] == "field" else 1.0) for row in rows],
        np.float64,
    )
    return weights / weights.sum()


def train_dataset(rows, cache, size, batch, classes, seed=7, field_weight=3.0):
    weights = sampling_weights(rows, field_weight)
    paths = np.array([str(cache / row["cache"]) for row in rows])
    targets = np.array([row["y"] for row in rows], np.int32)
    rng = np.random.default_rng(seed)

    def draw():
        while True:
            for i in rng.choice(len(rows), size=20000, p=weights):
                yield paths[i], targets[i]

    data = tf.data.Dataset.from_generator(draw, output_signature=(tf.TensorSpec((), tf.string), tf.TensorSpec((), tf.int32)))
    data = data.map(lambda p, y: (augment(decode(p, size, True)), tf.one_hot(y, classes)), AUTOTUNE, deterministic=False)
    return data.batch(batch, drop_remainder=True).map(mix, AUTOTUNE).prefetch(AUTOTUNE)


def macro_scores(truth, predicted, classes):
    truth, predicted = np.asarray(truth), np.asarray(predicted)
    f1, recall = [], []
    for c in range(classes):
        tp = np.sum((truth == c) & (predicted == c))
        support = np.sum(truth == c)
        if support == 0:
            continue
        precision = tp / max(np.sum(predicted == c), 1)
        rec = tp / support
        recall.append(rec)
        f1.append(0 if precision + rec == 0 else 2 * precision * rec / (precision + rec))
    return {"accuracy": float(np.mean(truth == predicted)), "macro_f1": float(np.mean(f1)), "balanced_accuracy": float(np.mean(recall))}


def subset(rows, split, per_class, domain=None, seed=3):
    rng = np.random.default_rng(seed)
    picked = []
    by_class = {}
    for row in rows:
        if row["split"] == split and (domain is None or row["domain"] == domain):
            by_class.setdefault(row["y"], []).append(row)
    for members in by_class.values():
        order = rng.permutation(len(members))[:per_class]
        picked.extend(members[i] for i in order)
    return picked


def probe(args):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler

    rows, labels = load_manifest(args.run)
    # Half the training sample is forced to be field photographs where a class has them.
    train = subset(rows, "train", 60, "field") + subset(rows, "train", 60, "lab") + subset(rows, "train", 40, "mixed")
    valid = subset(rows, "validation", 60, "field")
    print(f"probe: {len(train)} train, {len(valid)} field-validation images, {len(labels)} classes", flush=True)
    y_train, y_valid = np.array([r["y"] for r in train]), np.array([r["y"] for r in valid])
    report = {}
    for name in args.backbones:
        tf.keras.backend.clear_session()
        started = time.time()
        inputs, pooled, base = backbone(name, args.size)
        extractor = tf.keras.Model(inputs, pooled)
        x_train = extractor.predict(eval_dataset(train, args.cache, args.size, 64), verbose=0)
        x_valid = extractor.predict(eval_dataset(valid, args.cache, args.size, 64), verbose=0)
        scaler = StandardScaler().fit(x_train)
        best = None
        for c in (0.05, 0.3):
            classifier = LogisticRegression(C=c, max_iter=300).fit(scaler.transform(x_train), y_train)
            scores = macro_scores(y_valid, classifier.predict(scaler.transform(x_valid)), len(labels))
            if best is None or scores["macro_f1"] > best["macro_f1"]:
                best = {**scores, "C": c}
        report[name] = {**{k: round(v, 4) for k, v in best.items()}, "parameters_millions": round(base.count_params() / 1e6, 1),
                        "feature_width": int(x_train.shape[1]), "seconds": round(time.time() - started)}
        print(name, report[name], flush=True)
        (args.run / "backbone_probe.json").write_text(json.dumps(
            {"input_size": args.size, "train_images": len(train), "field_validation_images": len(valid),
             "method": "frozen ImageNet features, global average pooling, standardised, multinomial logistic regression",
             "results": report}, indent=2))


class FieldValidation(tf.keras.callbacks.Callback):
    """Scores field and studio validation photographs each epoch; keeps the best weights by field macro-F1."""

    def __init__(self, field, lab, cache, size, classes, path, history, train_field=None):
        super().__init__()
        self.sets = {"field": field, "lab": lab}
        if train_field:
            # Not used to choose anything: it only shows how far training runs ahead of validation.
            self.sets["train_field"] = train_field
        self.data = {k: eval_dataset(v, cache, size, 64) for k, v in self.sets.items()}
        self.truth = {k: np.array([r["y"] for r in v]) for k, v in self.sets.items()}
        self.classes, self.path, self.history, self.best = classes, path, history, -1.0

    def on_epoch_end(self, epoch, logs=None):
        entry = {"epoch": epoch + 1, "loss": float((logs or {}).get("loss", 0))}
        for name, data in self.data.items():
            predicted = np.argmax(self.model.predict(data, verbose=0), axis=1)
            entry[name] = {k: round(v, 4) for k, v in macro_scores(self.truth[name], predicted, self.classes).items()}
        self.history.append(entry)
        if entry["field"]["macro_f1"] > self.best:
            self.best = entry["field"]["macro_f1"]
            self.model.save_weights(self.path)
            entry["saved"] = True
        print(json.dumps(entry), flush=True)


def finetune(args):
    tf.keras.mixed_precision.set_global_policy("mixed_float16")
    rows, labels = load_manifest(args.run)
    classes = len(labels)
    train = [r for r in rows if r["split"] == "train"]
    field_valid = [r for r in rows if r["split"] == "validation" and r["domain"] != "lab"]
    lab_valid = subset(rows, "validation", 40, "lab")
    out = args.run / f"{args.backbone}-{args.size}"
    out.mkdir(parents=True, exist_ok=True)
    print(f"finetune {args.backbone}@{args.size}: {len(train)} train, {len(field_valid)} field-val, {classes} classes", flush=True)

    inputs, pooled, base = backbone(args.backbone, args.size)
    x = tf.keras.layers.Dropout(args.dropout)(pooled)
    logits = tf.keras.layers.Dense(classes, name="logits")(x)
    outputs = tf.keras.layers.Activation("softmax", dtype="float32", name="probabilities")(logits)
    model = tf.keras.Model(inputs, outputs)
    data = train_dataset(train, args.cache, args.size, args.batch, classes, field_weight=args.field_weight)
    loss = tf.keras.losses.CategoricalCrossentropy(label_smoothing=args.smoothing)
    history = []
    weights = str(out / "best.weights.h5")
    train_field = subset(rows, "train", 25, "field", seed=9)
    monitor = FieldValidation(field_valid, lab_valid, args.cache, args.size, classes, weights, history, train_field)

    # Stage 1: only the new classifier learns, so random gradients do not wreck the pretrained features.
    base.trainable = False
    model.compile(tf.keras.optimizers.AdamW(2e-3, weight_decay=1e-4), loss, jit_compile=False)
    stop = tf.keras.callbacks.TerminateOnNaN()
    model.fit(data, steps_per_epoch=args.steps // 2, epochs=args.warmup, callbacks=[stop, monitor], verbose=2)
    if not all(math.isfinite(entry["loss"]) for entry in history):
        raise SystemExit("The loss is not finite after the warm-up; stopping before the long stage.")

    # Stage 2: everything trains, cosine-decayed, batch-norm statistics kept frozen.
    base.trainable = True
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False
    total = args.steps * args.epochs
    schedule = tf.keras.optimizers.schedules.CosineDecay(1e-5, total, alpha=0.02, warmup_target=args.lr, warmup_steps=args.steps)
    model.compile(
        tf.keras.optimizers.AdamW(schedule, weight_decay=args.weight_decay, clipnorm=1.0), loss, jit_compile=False
    )
    model.fit(data, steps_per_epoch=args.steps, epochs=args.epochs, callbacks=[stop, monitor], verbose=2)

    model.load_weights(weights)
    tf.keras.mixed_precision.set_global_policy("float32")
    # Rebuild in float32 for export and copy the trained weights across.
    inputs, pooled, base = backbone(args.backbone, args.size)
    logits = tf.keras.layers.Dense(classes, name="logits")(tf.keras.layers.Dropout(args.dropout)(pooled))
    final = tf.keras.Model(inputs, tf.keras.layers.Activation("softmax", name="probabilities")(logits))
    final.set_weights(model.get_weights())
    final.save(out / "model.keras")
    (out / "class_indices.json").write_text(json.dumps(dict(enumerate(labels)), indent=2))
    (out / "training.json").write_text(json.dumps({
        "backbone": args.backbone, "input_size": args.size, "classes": classes, "train_images": len(train),
        "batch": args.batch, "steps_per_epoch": args.steps, "warmup_epochs": args.warmup, "epochs": args.epochs,
        "peak_learning_rate": args.lr, "selection": "best field-validation macro-F1", "best_field_macro_f1": monitor.best,
        "dropout": args.dropout, "label_smoothing": args.smoothing, "weight_decay": args.weight_decay,
        "field_weight": args.field_weight,
        "augmentation": "random crop 30-100%, flips, 90-degree turns, brightness, contrast, saturation, hue, JPEG 35-100, blur, mixup 0.2",
        "sampling": f"inverse square-root class frequency; field images weighted {args.field_weight:g}x studio images",
        "history": history,
    }, indent=2))
    print("FINETUNE_DONE", monitor.best, flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", choices=["probe", "finetune"])
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--backbones", nargs="+", default=list(BACKBONES))
    parser.add_argument("--backbone", default="EfficientNetV2S")
    parser.add_argument("--size", type=int, default=224)
    parser.add_argument("--batch", type=int, default=32)
    parser.add_argument("--steps", type=int, default=1500)
    parser.add_argument("--warmup", type=int, default=2)
    parser.add_argument("--epochs", type=int, default=14)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument("--smoothing", type=float, default=0.1)
    parser.add_argument("--weight-decay", type=float, default=5e-5)
    parser.add_argument("--field-weight", type=float, default=3.0)
    arguments = parser.parse_args()
    for gpu in tf.config.list_physical_devices("GPU"):
        tf.config.experimental.set_memory_growth(gpu, True)
    (probe if arguments.stage == "probe" else finetune)(arguments)
