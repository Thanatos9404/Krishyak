"""Verify all retained images with the exact decoder installed for training."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
import json
import hashlib
from pathlib import Path
from PIL import Image, ImageOps, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]

def check(row):
    try:
        with Image.open(ROOT / row['path']) as image:
            ImageOps.exif_transpose(image, in_place=True)
            with image.convert('RGB') as decoded:
                digest = hashlib.sha256(decoded.tobytes()).hexdigest()
        if row.get('pixel_hash') and digest != row['pixel_hash']:
            return {'path': row['path'], 'reason': 'Decoded pixels differ from the audited manifest', 'kind': 'pixel_hash_mismatch'}
        return None
    except Exception as exc:
        return {'path': row['path'], 'reason': f'{type(exc).__name__}: {exc}'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('run_dir', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--drop-invalid', action='store_true', help='Explicitly filter only an untrained manifest; default is read-only validation')
    args = parser.parse_args()
    manifest = args.run_dir / 'manifest.json'
    if args.drop_invalid and (args.run_dir / 'model.keras').exists():
        raise ValueError('Never modify a completed model manifest')
    rows = json.loads(manifest.read_text())
    failures = []
    with ThreadPoolExecutor(max_workers=2) as pool:
        for i, failure in enumerate(pool.map(check, rows)):
            if failure:
                failures.append(failure)
            if i % 10000 == 0:
                print(f'Decoder validation {i}/{len(rows)}', flush=True)
    bad = {row['path'] for row in failures}
    kept = [row for row in rows if row['path'] not in bad]
    (args.report or args.run_dir / 'runtime_decode_audit.json').write_text(json.dumps({
        'pillow_version': pillow_version, 'checked': len(rows), 'failures': failures,
        'manifest_sha256': hashlib.sha256(manifest.read_bytes()).hexdigest(),
        'manifest_modified': args.drop_invalid}, indent=2), encoding='utf-8')
    if args.drop_invalid:
        manifest.write_text(json.dumps(kept, indent=2), encoding='utf-8')
        audit_path = args.run_dir / 'data_audit.json'
        audit = json.loads(audit_path.read_text())
        audit['runtime_decoder_rejections'] = len(failures)
        audit['images'] = len(kept)
        audit['by_source_and_split'] = dict(Counter(r['source']+'/'+r['split'] for r in kept))
        audit_path.write_text(json.dumps(audit, indent=2), encoding='utf-8')
    print(json.dumps({'decoder': pillow_version, 'failures': len(failures), 'checked': len(rows), 'manifest_modified': args.drop_invalid}), flush=True)
    if failures and not args.drop_invalid:
        raise SystemExit(1)
