"""Reproduce publisher data by exact byte hashes, then fine-tune on a Colab GPU."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PARENT = ROOT / 'backend/training_runs/publisher-efficientnet-v1'
OUTPUT = ROOT / 'backend/training_runs/publisher-efficientnet-colab-v1'


def destination(root, row):
    path = (root / row['path']).resolve()
    if not path.is_relative_to((root / 'datasets/authentic').resolve()):
        raise ValueError('Dataset path escapes the authentic dataset directory')
    return path


def restore_archive(stream, root, rows, source):
    wanted = {row['sha256']: row for row in rows if row['source'] == source}
    restored = set()
    with tarfile.open(fileobj=stream, mode='r|gz') as archive:
        for member in archive:
            if not member.isfile():
                continue
            relative = member.name.partition('/')[2]
            if source == 'PlantVillage' and not relative.startswith('raw/color/'):
                continue
            if source == 'PlantDoc' and not relative.startswith(('train/', 'test/')):
                continue
            if member.size > 100 * 1024 * 1024:
                raise ValueError('Unexpected oversized image in publisher archive')
            with archive.extractfile(member) as file:
                payload = file.read()
            digest = hashlib.sha256(payload).hexdigest()
            row = wanted.get(digest)
            if row is None:
                continue
            target = destination(root, row)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
            restored.add(digest)
    if restored != set(wanted):
        raise ValueError(f'{source}: missing {len(set(wanted) - restored)} exact publisher images')
    print(f'{source}: restored {len(restored)} verified images', flush=True)


def main():
    import tensorflow as tf
    if not tf.config.list_physical_devices('GPU'):
        raise RuntimeError('Select a free T4 GPU runtime before running this notebook')
    rows = json.loads((PARENT / 'manifest.json').read_bytes())
    provenance = json.loads((PARENT / 'data_audit.json').read_bytes())
    if {row['source'] for row in rows} != {'PlantVillage', 'PlantDoc'}:
        raise ValueError('This run accepts only the two audited publisher sources')
    groups = {}
    for row in rows:
        if groups.setdefault(row['group'], row['split']) != row['split']:
            raise ValueError('Group leakage in manifest')
        destination(ROOT, row)
    repositories = {'PlantVillage': 'spMohanty/PlantVillage-Dataset',
                    'PlantDoc': 'pratikkayal/PlantDoc-Dataset'}
    for source, repository in repositories.items():
        revision = provenance['sources'][source]['revision']
        url = f'https://codeload.github.com/{repository}/tar.gz/{revision}'
        print(f'Restoring {source} from pinned revision {revision}', flush=True)
        with urllib.request.urlopen(url, timeout=180) as response:
            restore_archive(response, ROOT, rows, source)
    subprocess.run([sys.executable, str(ROOT / 'backend/finetune_disease_model.py'),
                    '--parent', str(PARENT), '--output', str(OUTPUT),
                    '--epochs', '12', '--steps', '1000', '--batch-size', '32'], check=True)
    subprocess.run([sys.executable, str(ROOT / 'backend/evaluate_disease_bundle.py'), str(OUTPUT)], check=True)
    print('Candidate evaluated. Independent field validation is still required; production unchanged.', flush=True)


if __name__ == '__main__':
    main()
