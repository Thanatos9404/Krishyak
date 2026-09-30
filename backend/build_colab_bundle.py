"""Package only audited public-data training inputs and a checksum-bound notebook."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'backend/training_runs/krishyak-colab-input-v2.zip'
    names = ['backend/' + name for name in ('colab_train_candidate.py', 'finetune_disease_model.py',
        'evaluate_disease_bundle.py', 'requirements-eval.txt', 'requirements-security.txt')]
    names += ['backend/training_runs/publisher-efficientnet-v1/' + name for name in (
        'model.keras', 'manifest.json', 'class_indices.json', 'data_audit.json', 'evaluation.json')]
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for name in names:
            archive.write(ROOT / name, name)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    code = f'''# Select a T4 GPU, run this cell and upload {output.name}.
from google.colab import files
from pathlib import Path
import hashlib, io, zipfile, subprocess, sys, shutil

session_bundle = Path("/content/{output.name}")
if session_bundle.is_file():
    payload = session_bundle.read_bytes()
else:
    uploaded = files.upload()
    assert len(uploaded) == 1, "Upload only {output.name}"
    payload = next(iter(uploaded.values()))
assert hashlib.sha256(payload).hexdigest() == "{digest}", "Bundle checksum mismatch; use the v2 bundle"
root = Path("/content/krishyak-audited")
root.mkdir(exist_ok=True)
with zipfile.ZipFile(io.BytesIO(payload)) as archive:
    for entry in archive.infolist():
        assert (root / entry.filename).resolve().is_relative_to(root.resolve()), "Unsafe archive path"
    archive.extractall(root)
def run_logged(command):
    with (root / "training-session.log").open("a", encoding="utf-8") as log:
        with subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                              text=True, bufsize=1) as process:
            for line in process.stdout:
                print(line, end="", flush=True)
                log.write(line)
                log.flush()
            if process.wait():
                raise subprocess.CalledProcessError(process.returncode, command)

environment = root / "training-venv"
run_logged([sys.executable, "-m", "venv", "--without-pip", str(environment)])
training_python = str(environment / "bin/python")
training_pip = [sys.executable, "-m", "pip", "--python", training_python]
run_logged(training_pip + ["install", "--only-binary=:all:", "-r", str(root / "backend/requirements-eval.txt")])
run_logged(training_pip + ["check"])
with (root / "training-environment.txt").open("w", encoding="utf-8") as record:
    subprocess.run(training_pip + ["freeze"], stdout=record, check=True)
def export_candidate():
    output = root / "backend/training_runs/publisher-efficientnet-colab-v1"
    output.mkdir(parents=True, exist_ok=True)
    for name in ("training-environment.txt", "training-session.log"):
        if (root / name).is_file():
            shutil.copyfile(root / name, output / name)
    result_zip = shutil.make_archive("/content/krishyak-colab-results", "zip", output)
    files.download(result_zip)

try:
    run_logged([training_python, "-u", str(root / "backend/colab_train_candidate.py")])
except BaseException:
    # Preserve partial checkpoints on a Python-level failure or manual interrupt.
    # A runtime reset cannot execute this handler; download checkpoints before disconnecting.
    try:
        export_candidate()
    except Exception as export_error:
        print("Recovery download failed:", export_error, flush=True)
    raise
else:
    export_candidate()
print("Candidate evaluated; production unchanged. Independent field validation remains required.")
'''
    notebook = {'nbformat': 4, 'nbformat_minor': 5, 'metadata': {
        'accelerator': 'GPU', 'colab': {'gpuType': 'T4'},
        'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'}},
        'cells': [{'cell_type': 'markdown', 'metadata': {}, 'source': [
            '# Krishyak audited GPU training\n',
            'Upload the matching v2 ZIP. Public publisher images are restored by exact byte hashes. '
            'Model selection uses validation only; test splits are preserved. The accuracy target is not guaranteed.\n']},
            {'cell_type': 'code', 'execution_count': None, 'metadata': {}, 'outputs': [], 'source': code.splitlines(True)}]}
    notebook_path = output.with_name('Krishyak_Authentic_GPU_Training_v2.ipynb')
    notebook_path.write_text(json.dumps(notebook, indent=2), encoding='utf-8')
    output.with_suffix('.sha256').write_text(digest + '\n')
    print(json.dumps({'bundle': str(output), 'sha256': digest, 'notebook': str(notebook_path)}))


if __name__ == '__main__':
    main()
