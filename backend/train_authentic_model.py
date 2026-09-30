"""Train an auditable candidate bundle. Never overwrite or auto-promote production weights.

Transfer learning caches the selected ImageNet backbone features once, then trains
a weighted head. Test and external test metrics are emitted only after model selection.
"""
import argparse
from collections import Counter
import hashlib
import json
import os
from pathlib import Path
import time
os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def cache_matches(metadata, manifest_hash, backbone_id):
    """A feature vector is reusable only for the same source rows and backbone."""
    return (metadata.get('manifest_sha256') == manifest_hash
            and metadata.get('backbone') == backbone_id)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run-dir', type=Path, default=ROOT / 'backend/training_runs/authentic-v2')
    parser.add_argument('--backbone', choices=['MobileNetV2', 'EfficientNetV2B0'], default='MobileNetV2')
    parser.add_argument('--epochs', type=int, default=40)
    parser.add_argument('--batch-size', type=int, default=32)
    parser.add_argument('--threads', type=int, default=6)
    parser.add_argument('--reuse-features', type=Path, help='Reuse only frozen ImageNet features matched by decoded image hash')
    parser.add_argument('--balance-domains', action='store_true')
    args = parser.parse_args()
    import tensorflow as tf
    from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, classification_report, confusion_matrix
    tf.config.threading.set_intra_op_parallelism_threads(args.threads)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    tf.keras.utils.set_random_seed(42)
    run = args.run_dir.resolve()
    if (run / 'model.keras').exists():
        raise FileExistsError('A trained model already exists; choose a new run directory.')
    backbone_id = 'ImageNet ' + args.backbone
    manifest_bytes = (run / 'manifest.json').read_bytes()
    records = json.loads(manifest_bytes)
    supported = sorted({r['label'] for r in records if r['split'] == 'train'})
    excluded = [r for r in records if r['label'] not in supported]
    (run / 'unsupported_classes.json').write_text(json.dumps({
        'reason': 'No training images remain after leakage prevention; these classes are not silently counted as supported.',
        'by_class': dict(Counter(r['label'] for r in excluded)), 'records': excluded}, indent=2))
    records = [r for r in records if r['label'] in supported]
    labels = {str(i): label for i, label in enumerate(supported)}
    (run / 'class_indices.json').write_text(json.dumps(labels, indent=2))
    lookup = {v: int(k) for k, v in labels.items()}
    y = np.array([lookup[r['label']] for r in records])
    masks = {split: np.array([r['split'] == split for r in records])
             for split in ['train', 'validation', 'test', 'external_test', 'legacy_validation']}
    missing = sorted(set(lookup.values()) - set(y[masks['train']]))
    if missing:
        raise ValueError(f'Classes without training images: {[labels[str(i)] for i in missing]}')
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    feature_path = run / 'features.npy'
    meta_path = run / 'feature_cache.json'
    inputs = tf.keras.Input(shape=(224, 224, 3), name='rgb_0_to_1')
    constructor = getattr(tf.keras.applications, args.backbone)
    options = {'include_preprocessing': False} if args.backbone == 'EfficientNetV2B0' else {}
    backbone = constructor(include_top=False, weights='imagenet', pooling='avg', **options)
    feature_dimension = int(backbone.output_shape[-1])
    backbone.trainable = False
    embedding = backbone(tf.keras.layers.Rescaling(2., offset=-1.)(inputs), training=False)
    extractor = tf.keras.Model(inputs, embedding)
    @tf.function(input_signature=[tf.TensorSpec([None, 224, 224, 3], tf.float32)])
    def extract(images):
        return extractor(images, training=False)
    if feature_path.exists() and meta_path.exists() and cache_matches(json.loads(meta_path.read_text()), manifest_hash, backbone_id):
        features = np.load(feature_path, mmap_mode='r')
        if features.shape != (len(records), feature_dimension):
            raise ValueError('Feature cache shape does not match the manifest and backbone')
    else:
        # A failed extraction must never leave a completion marker for partial data.
        meta_path.unlink(missing_ok=True)
        features = np.lib.format.open_memmap(feature_path, mode='w+', dtype='float32', shape=(len(records), feature_dimension))
        reusable = {}
        old_features = None
        if args.reuse_features:
            old_run = args.reuse_features.resolve()
            old_rows = json.loads((old_run / 'manifest.json').read_text())
            old_supported = {r['label'] for r in old_rows if r['split'] == 'train'}
            old_rows = [r for r in old_rows if r['label'] in old_supported]
            old_features = np.load(old_run / 'features.npy', mmap_mode='r')
            old_cache = json.loads((old_run / 'feature_cache.json').read_text())
            if not cache_matches(old_cache, hashlib.sha256((old_run / 'manifest.json').read_bytes()).hexdigest(), backbone_id):
                raise ValueError('Feature reuse requires the same ImageNet backbone and source manifest')
            if old_cache['manifest_sha256'] != hashlib.sha256((old_run / 'manifest.json').read_bytes()).hexdigest() or len(old_rows) != len(old_features):
                raise ValueError('Source feature cache does not match its manifest')
            reusable = {row['pixel_hash']: i for i, row in enumerate(old_rows)}
        started = time.monotonic()
        for start in range(0, len(records), args.batch_size):
            images, positions = [], []
            for position, row in enumerate(records[start:start + args.batch_size], start=start):
                if row['pixel_hash'] in reusable:
                    features[position] = old_features[reusable[row['pixel_hash']]]
                    continue
                try:
                    with Image.open(ROOT / row['path']) as image:
                        # Avoid two full-resolution copies of large original photos.
                        ImageOps.exif_transpose(image, in_place=True)
                        if image.mode == 'RGB':
                            rgb = image.resize((224, 224))
                        else:
                            with image.convert('RGB') as converted:
                                rgb = converted.resize((224, 224))
                        images.append(np.asarray(rgb, dtype=np.float32) / 255.)
                        rgb.close()
                        positions.append(position)
                except Exception as exc:
                    raise RuntimeError(f"Image decoding failed at row {position}: {row['path']}") from exc
            if images:
                features[positions] = extract(np.stack(images)).numpy()
            if start % (args.batch_size * 20) == 0:
                print(f'Features {start}/{len(records)}; elapsed {time.monotonic()-started:.0f}s', flush=True)
        features.flush()
        meta_path.write_text(json.dumps({'manifest_sha256': manifest_hash, 'backbone': backbone_id}))
    head = tf.keras.Sequential([
        tf.keras.Input(shape=(feature_dimension,)), tf.keras.layers.Dense(256, activation='relu'),
        tf.keras.layers.Dropout(.3), tf.keras.layers.Dense(len(labels), activation='softmax')])
    head.compile(optimizer=tf.keras.optimizers.Adam(3e-4), loss='sparse_categorical_crossentropy', metrics=['accuracy'])
    counts = Counter(y[masks['train']])
    weights = {int(k): float(np.clip(np.sqrt(np.mean(list(counts.values())) / n), .25, 4.)) for k, n in counts.items()}
    def domain_weights(mask):
        rows = [r for r, include in zip(records, mask) if include]
        source_counts = Counter(r['source'] for r in rows)
        priorities = {'PlantVillage': .4, 'PlantDoc': .4, 'legacy_unverified': .2}
        values = np.array([priorities[r['source']] / source_counts[r['source']] for r in rows], dtype=np.float32)
        return values / values.mean()
    train_weights = np.array([weights[int(label)] for label in y[masks['train']]], dtype=np.float32)
    validation = (np.asarray(features[masks['validation']]), y[masks['validation']])
    if args.balance_domains:
        train_weights *= domain_weights(masks['train'])
        validation = (*validation, domain_weights(masks['validation']))
    checkpoint = run / 'best_head.keras'
    history = head.fit(np.asarray(features[masks['train']]), y[masks['train']],
        validation_data=validation,
        batch_size=128, epochs=args.epochs, sample_weight=train_weights, verbose=2,
        callbacks=[tf.keras.callbacks.ModelCheckpoint(str(checkpoint), monitor='val_loss', save_best_only=True),
                   tf.keras.callbacks.EarlyStopping(monitor='val_loss', patience=7, restore_best_weights=True),
                   tf.keras.callbacks.ReduceLROnPlateau(monitor='val_loss', patience=3, factor=.5),
                   tf.keras.callbacks.CSVLogger(str(run / 'training.csv'))])
    head = tf.keras.models.load_model(checkpoint)
    model = tf.keras.Model(inputs, head(embedding))
    model.save(run / 'model.keras')
    reports = {}
    for split in ['validation', 'test', 'external_test', 'legacy_validation']:
        mask = masks[split]
        if not mask.any():
            reports[split] = {'samples': 0, 'accuracy': None}
            continue
        scores = head.predict(np.asarray(features[mask]), batch_size=256, verbose=0)
        actual = y[mask]
        predicted = scores.argmax(1)
        correct = int((actual == predicted).sum())
        n = len(actual)
        p = correct / n
        z = 1.96
        centre = (p + z*z/(2*n)) / (1+z*z/n)
        margin = z*np.sqrt(p*(1-p)/n + z*z/(4*n*n))/(1+z*z/n)
        reports[split] = {'samples': n, 'accuracy': float(accuracy_score(actual, predicted)),
            'accuracy_wilson_95': [centre-margin, centre+margin],
            'balanced_accuracy': float(balanced_accuracy_score(actual, predicted)),
            'macro_f1': float(f1_score(actual, predicted, labels=np.unique(actual), average='macro', zero_division=0)),
            'macro_f1_all_model_classes': float(f1_score(actual, predicted, labels=list(range(len(labels))), average='macro', zero_division=0)),
            'per_class': classification_report(actual, predicted, labels=list(range(len(labels))),
                target_names=[labels[str(i)] for i in range(len(labels))], output_dict=True, zero_division=0)}
        np.savez_compressed(run / f'{split}_predictions.npz', probabilities=scores, y_true=actual,
                            paths=np.array([r['path'] for r, take in zip(records, mask) if take]))
        np.savetxt(run / f'{split}_confusion_matrix.csv', confusion_matrix(actual, predicted, labels=list(range(len(labels)))), fmt='%d', delimiter=',')
    # A target is a gate, not a training score to invent or extrapolate.
    passed = all(reports[s].get('accuracy_wilson_95', [0])[0] > .94 for s in ['test', 'external_test'])
    metadata = {'architecture': args.backbone + ' ImageNet frozen backbone + weighted dense head',
        'preprocessing': 'RGB, EXIF orientation, PIL resize 224x224, divide by 255; embedded rescale to [-1,1]',
        'classes': len(labels), 'manifest_sha256': manifest_hash, 'seed': 42,
        'tensorflow_version': tf.__version__, 'epochs_run': len(history.history['loss']),
        'domain_balanced_training': args.balance_domains,
        'model_sha256': hashlib.sha256((run / 'model.keras').read_bytes()).hexdigest(),
        'target_accuracy': .94, 'target_gate_passed': passed, 'production_promoted': False,
        'excluded_classes_without_training_support': dict(Counter(r['label'] for r in excluded)),
        'excluded_images': len(excluded),
        'npss_comparison': 'Not evaluated; no paired NPSS benchmark was supplied.',
        'field_validated': False, 'metrics': reports}
    (run / 'evaluation.json').write_text(json.dumps(metadata, indent=2), encoding='utf-8')
    print(json.dumps({k: {m: v for m, v in r.items() if m != 'per_class'} for k,r in reports.items()}, indent=2), flush=True)
    print(f'Target gate passed: {passed}. Candidate saved; production unchanged.', flush=True)


if __name__ == '__main__':
    main()
