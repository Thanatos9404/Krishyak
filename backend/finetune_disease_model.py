"""Fine-tune a candidate backbone using training images and validation selection only.

Never installs production weights. Original test partitions are preserved for a later
explicit evaluation; this script does not inspect test scores during model selection.
"""
import argparse
import csv
import json
import os
from pathlib import Path
from collections import Counter
import hashlib
import math
import numpy as np
from PIL import Image, ImageOps

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
ROOT = Path(__file__).resolve().parents[1]


def resume_state(parent, output):
    """Validate experiment identity before changing any existing candidate files."""
    metadata = json.loads((output / 'finetuning.json').read_text())
    digest = hashlib.sha256((parent / 'model.keras').read_bytes()).hexdigest()
    if metadata.get('parent_model_sha256') != digest:
        raise ValueError('Resume parent model differs from the original experiment')
    for name in ('manifest.json', 'class_indices.json', 'data_audit.json'):
        if (parent / name).read_bytes() != (output / name).read_bytes():
            raise ValueError(f'Resume experiment metadata differs: {name}')
    if not (output / 'model.keras').is_file():
        raise ValueError('Resume checkpoint is missing')
    with (output / 'training.csv').open(newline='') as stream:
        completed = list(csv.DictReader(stream))
    if not completed:
        raise ValueError('Resume requires at least one completed epoch')
    epochs = [int(row['epoch']) for row in completed]
    losses = [float(row['val_loss']) for row in completed]
    if epochs != list(range(len(epochs))) or not all(math.isfinite(loss) and loss >= 0 for loss in losses):
        raise ValueError('Resume history has invalid epochs or validation losses')
    return len(epochs), min(losses)


def decode(path):
    path = path.numpy().decode()
    with Image.open(path) as image:
        ImageOps.exif_transpose(image, in_place=True)
        if image.mode == 'RGB':
            small = image.resize((224, 224))
        else:
            with image.convert('RGB') as rgb:
                small = rgb.resize((224, 224))
        array = np.asarray(small, dtype=np.float32) / 255.
        small.close()
        return array


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--parent', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--epochs', type=int, default=8)
    parser.add_argument('--steps', type=int, default=500)
    parser.add_argument('--batch-size', type=int, default=16)
    parser.add_argument('--resume', action='store_true', help='Resume an interrupted candidate from its best checkpoint')
    args = parser.parse_args()
    import tensorflow as tf
    tf.config.threading.set_intra_op_parallelism_threads(6)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(43)
    args.output.mkdir(parents=True, exist_ok=True)
    if (args.output / 'model.keras').exists() and not args.resume:
        raise FileExistsError('Choose a new candidate directory; do not overwrite a completed experiment.')
    initial_epoch, prior_best = resume_state(args.parent, args.output) if args.resume else (0, float('inf'))
    rows = json.loads((args.parent / 'manifest.json').read_text())
    labels = json.loads((args.parent / 'class_indices.json').read_text())
    lookup = {name: int(i) for i, name in labels.items()}
    rows = [r for r in rows if r['label'] in lookup]
    for filename in ['manifest.json', 'class_indices.json', 'data_audit.json']:
        (args.output / filename).write_bytes((args.parent / filename).read_bytes())
    train = [r for r in rows if r['split'] == 'train']
    validation = [r for r in rows if r['split'] == 'validation']

    def dataset(records, repeat=False):
        counts = Counter(r['source'] for r in records)
        priorities = {'PlantVillage': .4, 'PlantDoc': .4, 'legacy_unverified': .2}
        weights = np.array([priorities[r['source']] / counts[r['source']] for r in records], np.float32)
        weights /= weights.mean()
        ds = tf.data.Dataset.from_tensor_slices((
            [str(ROOT / r['path']) for r in records],
            [lookup[r['label']] for r in records], weights))
        if repeat:
            ds = ds.shuffle(len(records), seed=43, reshuffle_each_iteration=True).repeat()
        def load(path, label, weight):
            pixels = tf.py_function(decode, [path], Tout=tf.float32)
            pixels.set_shape((224, 224, 3))
            return pixels, label, weight
        return ds.map(load, num_parallel_calls=2).batch(args.batch_size).prefetch(1)

    if args.resume:
        model = tf.keras.models.load_model(args.output / 'model.keras')
        print(f'Resuming best checkpoint after {initial_epoch} completed epochs; shuffle restarts at seed 43.', flush=True)
    else:
        parent = tf.keras.models.load_model(args.parent / 'model.keras', compile=False)
        backbone = next(layer for layer in parent.layers if any(name in layer.name.lower() for name in ('mobilenetv2', 'efficientnetv2')))
        backbone.trainable = True
        for layer in backbone.layers[:-35]:
            layer.trainable = False
        for layer in backbone.layers:
            if isinstance(layer, tf.keras.layers.BatchNormalization):
                layer.trainable = False
        inputs = tf.keras.Input((224, 224, 3))
        augmented = tf.keras.Sequential([
            tf.keras.layers.RandomFlip('horizontal'),
            tf.keras.layers.RandomRotation(.08, fill_mode='reflect'),
            tf.keras.layers.RandomContrast(.15),
        ])(inputs)
        model = tf.keras.Model(inputs, parent(augmented))
        model.compile(tf.keras.optimizers.Adam(1e-5), 'sparse_categorical_crossentropy', metrics=['accuracy'])
    metadata = {'parent': str(args.parent), 'parent_model_sha256': hashlib.sha256((args.parent / 'model.keras').read_bytes()).hexdigest(),
                'seed': 43, 'learning_rate': 1e-5, 'unfrozen_tail_layers': 35, 'batch_norm_frozen': True,
                'train_images': len(train), 'validation_images': len(validation), 'epochs_requested': args.epochs,
                'steps_per_epoch': args.steps, 'resumed_after_epoch': initial_epoch, 'production_promoted': False, 'status': 'running'}
    (args.output / 'finetuning.json').write_text(json.dumps(metadata, indent=2))
    history = model.fit(dataset(train, True), validation_data=dataset(validation), epochs=args.epochs, initial_epoch=initial_epoch,
        steps_per_epoch=args.steps, verbose=2, callbacks=[
            tf.keras.callbacks.ModelCheckpoint(str(args.output / 'model.keras'), monitor='val_loss', save_best_only=True, initial_value_threshold=prior_best),
            tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=3, restore_best_weights=True),
            tf.keras.callbacks.CSVLogger(str(args.output / 'training.csv'), append=args.resume)])
    metadata.update(status='trained_pending_evaluation', epochs_run=initial_epoch + len(history.history.get('loss', [])),
                    best_validation_loss=min([prior_best, *history.history.get('val_loss', [])]))
    (args.output / 'finetuning.json').write_text(json.dumps(metadata, indent=2))
    print('Fine-tuning finished. Candidate requires explicit held-out evaluation; production unchanged.', flush=True)


if __name__ == '__main__':
    main()
