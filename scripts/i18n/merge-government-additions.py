"""Merge reviewed-in-code model drafts without a translation API or false provenance."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ADDITIONS = Path(__file__).parent / "government-additions"
codes = json.loads((ROOT / "frontend/src/i18n/pilotLanguages.json").read_text(encoding="utf-8"))["codes"]
source_text = (ROOT / "frontend/src/features/product/locales/en.json").read_text(encoding="utf-8")
source = json.loads(source_text)
keys = json.loads((ADDITIONS / "source.json").read_text(encoding="utf-8"))

def sha(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

directory = ROOT / "frontend/public/locales/workspace"
for code in codes:
    if code == "en":
        continue
    translations = (ADDITIONS / f"{code}.txt").read_text(encoding="utf-8").splitlines()
    if len(translations) != len(keys) or any(not value.strip() for value in translations):
        raise ValueError(f"{code}: incomplete additions")
    path = directory / f"{code}.json"
    pack = json.loads(path.read_text(encoding="utf-8"))
    additions = dict(zip(keys, translations, strict=True))
    if any(key not in source for key in additions):
        raise ValueError(f"{code}: unknown addition key")
    pack.update(additions)
    if set(pack) != set(source):
        raise ValueError(f"{code}: missing/obsolete source keys")
    pack_text = json.dumps({key: pack[key] for key in source}, ensure_ascii=False, indent=2) + "\n"
    path.write_text(pack_text, encoding="utf-8")
    meta_path = directory / f"{code}.meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    # Keep the original generator disclosed; identify additions separately.
    meta.update(provider="Sarvam + Codex", source_sha256=sha(source_text), pack_sha256=sha(pack_text),
                strings=len(pack), additions={"provider": "Codex", "method": "model_draft_authored_in_code",
                "source_keys": keys, "source_keys_sha256": sha(json.dumps(keys, ensure_ascii=False)),
                "review_status": "machine_translated_needs_native_review", "paid_translation_calls": 0})
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"pilot_packs": len(codes) - 1, "strings_per_pack": len(source), "new_strings": len(keys), "external_translation_calls": 0}))
