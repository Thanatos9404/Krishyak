"""Export a pinned dataset git tree, giving images Windows-safe content-based names.

Original paths are retained in provenance.json. Does not modify the source repo.
"""
import argparse
import hashlib
import json
import subprocess
import tarfile
from pathlib import Path


def export(repo, output):
    repo, output = Path(repo).resolve(), Path(output).resolve()
    revision = subprocess.check_output(['git', '-C', str(repo), 'rev-parse', 'HEAD'], text=True).strip()
    proc = subprocess.Popen(['git', '-c', 'core.protectNTFS=false', '-C', str(repo), 'archive', revision], stdout=subprocess.PIPE)
    records = []
    with tarfile.open(fileobj=proc.stdout, mode='r|') as archive:
        for member in archive:
            if not member.isfile():
                continue
            parts = Path(member.name).parts
            if any(p in ('..', '.') for p in parts) or Path(member.name).is_absolute():
                raise ValueError('Unsafe archive path')
            data = archive.extractfile(member).read()
            digest = hashlib.sha256(data).hexdigest()
            suffix = Path(member.name).suffix.lower()
            if suffix in ('.jpg', '.jpeg', '.png', '.webp', '.bmp'):
                target = output.joinpath(*parts[:-1], digest + suffix)
            elif suffix in ('.json', '.md', '.txt', '.cff'):
                target = output.joinpath(*parts)
            else:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            records.append({'original_path': member.name, 'export_path': target.relative_to(output).as_posix(),
                            'sha256': digest})
    if proc.wait():
        raise RuntimeError('git archive failed')
    output.mkdir(parents=True, exist_ok=True)
    (output / 'provenance.json').write_text(json.dumps({'revision': revision, 'records': records}, indent=2), encoding='utf-8')
    print(json.dumps({'revision': revision, 'files': len(records), 'output': str(output)}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('repo')
    parser.add_argument('output')
    args = parser.parse_args()
    export(args.repo, args.output)
