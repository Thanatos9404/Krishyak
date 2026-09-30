"""Evaluate a saved candidate against its unchanged grouped manifest. No training."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps

os.environ.setdefault('TF_CPP_MIN_LOG_LEVEL', '2')
ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--batch-size', type=int, default=32)
    args = parser.parse_args()
    import tensorflow as tf
    from sklearn.metrics import balanced_accuracy_score, f1_score, classification_report, confusion_matrix
    tf.config.threading.set_intra_op_parallelism_threads(6)
    tf.config.threading.set_inter_op_parallelism_threads(2)
    bundle = args.bundle
    model = tf.keras.models.load_model(bundle / 'model.keras', compile=False)
    labels = json.loads((bundle / 'class_indices.json').read_text())
    lookup = {name: int(i) for i, name in labels.items()}
    rows = json.loads((bundle / 'manifest.json').read_text())
    groups = {}
    for row in rows:
        previous = groups.setdefault(row['group'], row['split'])
        if previous != row['split']:
            raise ValueError('Group leakage in manifest')
    @tf.function(input_signature=[tf.TensorSpec([None, 224, 224, 3], tf.float32)])
    def predict(images):
        return model(images, training=False)
    reports = {}
    for split in ('validation', 'test', 'external_test', 'legacy_validation'):
        selected = [r for r in rows if r['split'] == split and r['label'] in lookup]
        if not selected:
            continue
        scores = []
        for start in range(0, len(selected), args.batch_size):
            images = []
            for row in selected[start:start + args.batch_size]:
                with Image.open(ROOT / row['path']) as image:
                    ImageOps.exif_transpose(image, in_place=True)
                    if image.mode == 'RGB':
                        small = image.resize((224, 224))
                    else:
                        with image.convert('RGB') as rgb:
                            small = rgb.resize((224, 224))
                    images.append(np.asarray(small, dtype=np.float32) / 255.)
                    small.close()
            scores.append(predict(np.stack(images)).numpy())
            if start % 1024 == 0:
                print(f'{split}: {start}/{len(selected)}', flush=True)
        scores = np.concatenate(scores)
        actual = np.array([lookup[r['label']] for r in selected])
        predicted = scores.argmax(1)
        n = len(actual)
        accuracy = float(np.mean(actual == predicted))
        z = 1.96
        centre = (accuracy + z*z/(2*n)) / (1+z*z/n)
        margin = z*np.sqrt(accuracy*(1-accuracy)/n + z*z/(4*n*n))/(1+z*z/n)
        reports[split] = dict(samples=n, accuracy=accuracy, accuracy_wilson_95=[centre-margin, centre+margin],
            balanced_accuracy=float(balanced_accuracy_score(actual, predicted)),
            macro_f1=float(f1_score(actual, predicted, labels=np.unique(actual), average='macro', zero_division=0)),
            per_class=classification_report(actual, predicted, labels=list(range(len(labels))),
                target_names=[labels[str(i)] for i in range(len(labels))], output_dict=True, zero_division=0))
        np.savez_compressed(bundle / f'{split}_predictions.npz', probabilities=scores, y_true=actual,
                            paths=np.array([r['path'] for r in selected]))
        np.savetxt(bundle / f'{split}_confusion_matrix.csv', confusion_matrix(actual, predicted, labels=list(range(len(labels)))), fmt='%d', delimiter=',')
        print(json.dumps({k: v for k, v in reports[split].items() if k != 'per_class'}), flush=True)
    passed = all(reports.get(split, {}).get('accuracy_wilson_95', [0])[0] > .94 for split in ('test', 'external_test'))
    result = dict(classes=len(labels), model_sha256=hashlib.sha256((bundle / 'model.keras').read_bytes()).hexdigest(),
                  manifest_sha256=hashlib.sha256((bundle / 'manifest.json').read_bytes()).hexdigest(),
                  metrics=reports, target_gate_passed=passed, production_promoted=False, field_validated=False,
                  npss_comparison='Not evaluated; paired benchmark required.')
    (bundle / 'evaluation.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(f'Accuracy gate passed: {passed}. Production unchanged.', flush=True)


if __name__ == '__main__':
    main()
