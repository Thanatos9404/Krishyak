"""Prepare a clean, linked Vercel monorepo upload without changing project roots.
Only tracked component files are copied; secrets, caches and authoring assets are
excluded. Run after committing source. Existing local project linkage is required.
"""
import argparse
import fnmatch
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

def prepare(component):
    root=Path(__file__).resolve().parents[1]
    source=root/component
    link=source/'.vercel/project.json'
    if not link.is_file(): raise SystemExit(f'Link the existing {component} Vercel project first')
    staging=root/'.codex-tmp'; staging.mkdir(exist_ok=True)
    stage=Path(tempfile.mkdtemp(prefix=f'vercel-{component}-',dir=staging))
    ignore=source/'.vercelignore'
    patterns=[line.strip().rstrip('/') for line in ignore.read_text().splitlines() if line.strip() and not line.lstrip().startswith('#')] if ignore.exists() else []
    files=subprocess.check_output(['git','ls-files',component],cwd=root,text=True).splitlines()
    size=0
    for name in files:
        relative=name.removeprefix(component+'/')
        if any(fnmatch.fnmatch(relative,p) or relative.startswith(p+'/') for p in patterns): continue
        if any(part in {'.env','.vercel','node_modules','venv','__pycache__','build'} for part in Path(relative).parts) or Path(relative).name.startswith('.env'): continue
        target=stage/name; target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(root/name,target); size+=(root/name).stat().st_size
    (stage/'.vercel').mkdir(); shutil.copyfile(link,stage/'.vercel/project.json')
    (stage/'.vercelignore').write_text('.vercel/\n')
    if component=='backend':
        for needed in ['main.py','requirements.txt','models/active/model.tflite','models/active/class_indices.json','models/active/runtime-verification.json']:
            if not (stage/component/needed).is_file(): raise SystemExit(f'Missing committed runtime file: {needed}')
        if (stage/component/'models/active/model.keras').exists(): raise SystemExit('Full Keras artifact must remain outside the serverless package')
    print(json.dumps({'path':str(stage),'source_bytes':size}))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('component',choices=['backend','frontend'])
    prepare(parser.parse_args().component)
