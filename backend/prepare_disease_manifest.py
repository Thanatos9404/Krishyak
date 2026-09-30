"""Create source-traceable grouped splits without copying images or using test data to train."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path
import subprocess
import re
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DOC_LABELS = {
    'Apple Scab Leaf': 'Apple___Apple_scab', 'Apple leaf': 'Apple___healthy',
    'Apple rust leaf': 'Apple___Cedar_apple_rust', 'Bell_pepper leaf spot': 'Pepper,_bell___Bacterial_spot',
    'Bell_pepper leaf': 'Pepper,_bell___healthy', 'Blueberry leaf': 'Blueberry___healthy',
    'Cherry leaf': 'Cherry_(including_sour)___healthy', 'Corn Gray leaf spot': 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Corn leaf blight': 'Corn_(maize)___Northern_Leaf_Blight', 'Corn rust leaf': 'Corn_(maize)___Common_rust_',
    'Peach leaf': 'Peach___healthy', 'Potato leaf early blight': 'Potato___Early_blight',
    'Potato leaf late blight': 'Potato___Late_blight', 'Raspberry leaf': 'Raspberry___healthy',
    'Soyabean leaf': 'Soybean___healthy', 'Squash Powdery mildew leaf': 'Squash___Powdery_mildew',
    'Strawberry leaf': 'Strawberry___healthy', 'Tomato Early blight leaf': 'Tomato___Early_blight',
    'Tomato Septoria leaf spot': 'Tomato___Septoria_leaf_spot', 'Tomato leaf bacterial spot': 'Tomato___Bacterial_spot',
    'Tomato leaf late blight': 'Tomato___Late_blight', 'Tomato leaf mosaic virus': 'Tomato___Tomato_mosaic_virus',
    'Tomato leaf yellow virus': 'Tomato___Tomato_Yellow_Leaf_Curl_Virus', 'Tomato leaf': 'Tomato___healthy',
    'Tomato mold leaf': 'Tomato___Leaf_Mold', 'Tomato two spotted spider mites leaf': 'Tomato___Spider_mites Two-spotted_spider_mite',
    'grape leaf black rot': 'Grape___Black_rot', 'grape leaf': 'Grape___healthy',
}
LEGACY_LABELS = {
    'Common_Rust': 'Corn_(maize)___Common_rust_',
    'Gray_Leaf_Spot': 'Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot',
    'Healthy Maize': 'Corn_(maize)___healthy',
}


def stable_split(group):
    value = int(hashlib.sha256(('krishyak-v2:' + group).encode()).hexdigest()[:8], 16) % 100
    return 'train' if value < 75 else 'validation' if value < 85 else 'test'


def build(output, include_legacy=True):
    pv = ROOT / 'datasets/authentic/PlantVillage'
    doc = ROOT / 'datasets/authentic/PlantDoc-export'
    leafmap = json.loads((pv / 'leaf-map.json').read_text())
    provenance = json.loads((doc / 'provenance.json').read_text())
    doc_paths = {r['export_path']: r['original_path'] for r in provenance['records']}
    candidates = []
    old_labels = json.loads((ROOT / 'backend/models/class_indices.json').read_text())
    canonical_legacy = {re.sub('[^a-z0-9]', '', label.lower()): label for label in old_labels.values()}
    for path in sorted((pv / 'raw/color').glob('*/*')):
        label = path.parent.name
        identifier = path.stem.split('___')[-1].split('copy')[0].strip().lower()
        ids = leafmap.get(identifier, [])
        group = next((g for g in ids if label in g), 'pv:' + label + ':' + identifier)
        candidates.append((path, label, 'PlantVillage', group, None))
    for split in ['test', 'train']:
        for path in sorted((doc / split).glob('*/*')):
            label = DOC_LABELS[path.parent.name]
            original = doc_paths[path.relative_to(doc).as_posix()]
            # The published test partition remains an external domain test.
            group = 'doc:' + label + ':' + Path(original).stem.lower()
            candidates.append((path, label, 'PlantDoc', group, 'external_test' if split == 'test' else None))
    if include_legacy:
        for split in ['Train', 'Validation']:
            for path in sorted((ROOT / 'datasets/pdisease' / split).glob('*/*')):
                label = canonical_legacy.get(re.sub('[^a-z0-9]', '', path.parent.name.lower()), path.parent.name)
                label = LEGACY_LABELS.get(label, label)
                # Existing collection has no publisher manifest; disclose it separately.
                candidates.append((path, label, 'legacy_unverified', 'legacy:' + label + ':' + path.stem.lower(),
                                   'legacy_validation' if split == 'Validation' else None))
    records, rejected = [], []
    cache_path = output / 'fingerprint_cache.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    hashes, visual_hashes, parents = {}, {}, {}

    def find(x):
        parents.setdefault(x, x)
        while parents[x] != x:
            parents[x] = parents[parents[x]]
            x = parents[x]
        return x

    def union(a, b):
        a, b = find(a), find(b)
        parents[max(a, b)] = min(a, b)

    for i, (path, label, source, group, forced) in enumerate(candidates):
        if path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
            continue
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in cache:
                pixel_hash, visual = cache[digest]
            else:
                with Image.open(path) as image:
                    rgb = ImageOps.exif_transpose(image).convert('RGB')
                    pixel_hash = hashlib.sha256(rgb.tobytes()).hexdigest()
                    # Exact dHash matches are grouped, but a collision alone is not a conflicting annotation.
                    gray = list(rgb.convert('L').resize((9, 8)).getdata())
                    visual = ''.join('1' if gray[y*9+x] > gray[y*9+x+1] else '0' for y in range(8) for x in range(8))
                cache[digest] = [pixel_hash, visual]
        except Exception as exc:
            rejected.append({'path': path.relative_to(ROOT).as_posix(), 'reason': type(exc).__name__})
            continue
        group = find(group)
        for key, table in [(pixel_hash, hashes), (visual, visual_hashes)]:
            if key in table:
                union(group, table[key])
            table[key] = group
        records.append({'path': path.relative_to(ROOT).as_posix(), 'label': label, 'source': source,
                        'group': group, 'sha256': digest, 'pixel_hash': pixel_hash, 'forced': forced})
        if i % 5000 == 0:
            print(f'Validated {i}/{len(candidates)} images', flush=True)
    groups = defaultdict(list)
    for row in records:
        row['group'] = find(row['group'])
        groups[row['group']].append(row)
    pixel_labels = defaultdict(set)
    for row in records:
        pixel_labels[row['pixel_hash']].add(row['label'])
    kept, duplicates, conflicts = [], 0, []
    for group, rows in groups.items():
        conflicting = [r for r in rows if len(pixel_labels[r['pixel_hash']]) > 1]
        conflicts.extend(conflicting)
        rows = [r for r in rows if len(pixel_labels[r['pixel_hash']]) == 1]
        if not rows:
            continue
        reserved = {r['forced'] for r in rows}
        split = ('external_test' if 'external_test' in reserved else
                 'legacy_validation' if 'legacy_validation' in reserved else stable_split(group))
        seen = set()
        for row in rows:
            if row['pixel_hash'] in seen:
                duplicates += 1
                continue
            seen.add(row['pixel_hash'])
            row['split'] = split
            row.pop('forced')
            kept.append(row)
    labels = sorted({r['label'] for r in kept})
    summary = {
        'sources': {
            'PlantVillage': {'url': 'https://github.com/spMohanty/PlantVillage-Dataset',
                            'revision': (subprocess.check_output(['git', '-C', str(pv), 'rev-parse', 'HEAD'], text=True).strip()
                                         if (pv / '.git').exists() else json.loads((pv / 'source_revision.json').read_text())['revision'])},
            'PlantDoc': {'url': 'https://github.com/pratikkayal/PlantDoc-Dataset', 'revision': provenance['revision'], 'license': 'CC-BY-4.0'},
            'legacy_unverified': {'provenance': 'Existing repository collection; exact original sources and licenses not established'},
        },
        'images': len(kept), 'classes': len(labels), 'duplicates_removed': duplicates,
        'corrupt_images': len(rejected), 'conflicting_images_quarantined': len(conflicts),
        'by_source_and_split': dict(Counter(r['source'] + '/' + r['split'] for r in kept)),
        'split_policy': '75/10/15 deterministic group split; published PlantDoc test reserved; leaf IDs and exact perceptual hashes grouped globally',
        'limitation': 'Exact perceptual hashing does not eliminate all near-duplicate or unknown farm/session leakage; independent Indian field validation remains necessary.',
    }
    output.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(cache), encoding='utf-8')
    for name, data in [('manifest.json', kept), ('data_audit.json', summary), ('quarantine.json', {'corrupt': rejected, 'conflicts': conflicts}),
                       ('class_indices.json', dict(enumerate(labels)))]:
        (output / name).write_text(json.dumps(data, indent=2), encoding='utf-8')
    print(json.dumps(summary, indent=2), flush=True)


def reserve_legacy_validation(output):
    """Reserve whole retained groups matching the old validation set, including deduplicated rows."""
    records = json.loads((output / 'manifest.json').read_text())
    reserved_hashes = set()
    for path in (ROOT / 'datasets/pdisease/Validation').glob('*/*'):
        try:
            with Image.open(path) as image:
                rgb = ImageOps.exif_transpose(image).convert('RGB')
                reserved_hashes.add(hashlib.sha256(rgb.tobytes()).hexdigest())
        except Exception:
            continue
    groups = {r['group'] for r in records if r['pixel_hash'] in reserved_hashes}
    external_groups = {r['group'] for r in records if r['split'] == 'external_test'}
    for row in records:
        if row['group'] in groups - external_groups:
            row['split'] = 'legacy_validation'
    (output / 'manifest.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    audit = json.loads((output / 'data_audit.json').read_text())
    audit['by_source_and_split'] = dict(Counter(r['source'] + '/' + r['split'] for r in records))
    audit['legacy_validation_policy'] = 'All retained groups matching original validation pixels are excluded from training and model selection.'
    (output / 'data_audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')
    print(json.dumps(audit['by_source_and_split'], indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'backend/training_runs/authentic-v2')
    parser.add_argument('--authentic-only', action='store_true')
    parser.add_argument('--reserve-existing', action='store_true')
    args = parser.parse_args()
    if not args.reserve_existing:
        build(args.output, not args.authentic_only)
    if not args.authentic_only:
        reserve_legacy_validation(args.output)
