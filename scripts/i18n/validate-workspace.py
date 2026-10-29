"""Offline release validation of real static packs, provenance and placeholders.

This checks structural/script integrity, not native-speaker or semantic approval.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LANGUAGES = "as bn brx doi gu hi kn ks kok mai ml mni mr ne or pa sa sat sd ta te ur".split()
PILOT = [code for code in json.loads((ROOT / "frontend/src/i18n/pilotLanguages.json").read_text(encoding="utf-8"))["codes"] if code != "en"]
PLACEHOLDERS = re.compile(r"\{\{\w+\}\}")
CRITICAL = {
    "Mobile number", "Six-digit code", "Send sign-in code", "Verify & continue",
    "Namaste, {{v0}}", "Your farm, field by field.", "Note what I saw",
    "Your farming helper that listens.", "Start free", "Ask Krishyak", "Tap to speak",
    "Allow voice help", "Allow and start", "Type your question", "Plant check", "My fields",
    "Save account details", "Choose your language", "Read today’s advice aloud",
    "Your account. Your decisions.", "Start with a clear photograph.",
    "Prices with a place and a date.", "No voice is available for this language. Written advice remains available.",
    "Your fields, crops and prices in one place.", "Sign in with fingerprint or screen lock",
    "New here? Create my account", "Create account", "Write down your recovery code",
    "Check a sick plant", "Mandi prices", "What to do next", "Weather",
}
BLOCKS = {
    "as": [(0x980, 0x9FF)], "bn": [(0x980, 0x9FF)],
    "gu": [(0xA80, 0xAFF)], "kn": [(0xC80, 0xCFF)],
    "ml": [(0xD00, 0xD7F)], "or": [(0xB00, 0xB7F)],
    "pa": [(0xA00, 0xA7F)], "ta": [(0xB80, 0xBFF)], "te": [(0xC00, 0xC7F)],
    "ks": [(0x600, 0x6FF)], "sd": [(0x600, 0x6FF)], "ur": [(0x600, 0x6FF)],
    "sat": [(0x1C50, 0x1C7F)], "mni": [(0xABC0, 0xABFF)],
}
for code in ["hi", "brx", "doi", "kok", "mai", "mr", "ne", "sa"]:
    BLOCKS[code] = [(0x900, 0x97F)]

def sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def validate(languages, output):
    source_path = ROOT / "frontend/src/features/product/locales/en.json"
    source_text = source_path.read_text(encoding="utf-8")
    source = json.loads(source_text)
    crop_catalog = json.loads((ROOT / "frontend/src/features/product/cropCatalog.json").read_text(encoding="utf-8"))
    glossary_path = ROOT / "scripts/i18n/glossary.json"
    glossary_text = glossary_path.read_text(encoding="utf-8")
    glossary = json.loads(glossary_text)["preserve"]
    directory = ROOT / "frontend/public/locales/workspace"
    results, failures = [], []
    version = json.loads((source_path.parent / "version.json").read_text(encoding="utf-8"))
    if version.get("source_sha256") != sha(source_text):
        failures.append("workspace locale URL version does not match the current source")
    for code in languages:
        path = directory / f"{code}.json"
        meta_path = directory / f"{code}.meta.json"
        if not path.exists() or not meta_path.exists():
            failures.append(f"{code}: pack or metadata missing")
            continue
        text = path.read_text(encoding="utf-8")
        pack, meta = json.loads(text), json.loads(meta_path.read_text(encoding="utf-8"))
        before = len(failures)
        if set(pack) != set(source): failures.append(f"{code}: source key mismatch")
        if meta.get("source_sha256") != sha(source_text): failures.append(f"{code}: source hash mismatch")
        if meta.get("pack_sha256") != sha(text): failures.append(f"{code}: pack hash mismatch")
        if meta.get("glossary_sha256") != sha(glossary_text): failures.append(f"{code}: glossary hash mismatch")
        document_sindhi = (code == "sd" and meta.get("provider") == "Sarvam"
            and meta.get("model") == "provider-managed-document-translation"
            and meta.get("method") == "document_translation_arabic_script_guidelines"
            and meta.get("api") == "/translate/document/jobs")
        if meta.get("model") != "sarvam-translate:v1" and not document_sindhi: failures.append(f"{code}: model provenance missing")
        try:
            generated = datetime.fromisoformat(meta["generated_at"])
            if generated.utcoffset() is None: raise ValueError()
        except (KeyError, TypeError, ValueError): failures.append(f"{code}: dated generation provenance missing")
        if meta.get("provider") not in {"Sarvam", "Sarvam + Codex"} or meta.get("review_status") != "machine_translated_needs_native_review": failures.append(f"{code}: provenance/review disclosure missing")
        if meta.get("provider") == "Sarvam + Codex":
            additions = meta.get("additions", {})
            addition_keys = additions.get("source_keys", [])
            if (additions.get("provider") != "Codex" or additions.get("method") != "model_draft_authored_in_code"
                or additions.get("review_status") != "machine_translated_needs_native_review"
                or additions.get("source_keys_sha256") != sha(json.dumps(addition_keys, ensure_ascii=False))
                or not addition_keys or not set(addition_keys).issubset(source)):
                failures.append(f"{code}: additions provenance disclosure missing")
        unchanged = []
        crop_names = [pack.get(row["label"], "").strip().casefold() for row in crop_catalog]
        if len(set(crop_names)) != len(crop_names): failures.append(f"{code}: distinct crop identities have ambiguous labels")
        for key in source:
            value = pack.get(key)
            if not isinstance(value, str) or not value.strip():
                failures.append(f"{code}: empty/invalid label")
                continue
            if Counter(PLACEHOLDERS.findall(key)) != Counter(PLACEHOLDERS.findall(value)): failures.append(f"{code}: placeholders changed: {key}")
            if re.search(r"ZXQ\d+QXZ|\[90{7,}", value): failures.append(f"{code}: untranslated generation marker")
            for word in glossary:
                # Indian-language grammatical suffixes may touch a preserved
                # Latin brand (for example Krishyak + a Telugu suffix).
                # Check exact Latin identity without rejecting those suffixes.
                boundary = r"[A-Za-z0-9_]" if word.isascii() else r"\w"
                pattern = r"(?<!" + boundary + ")" + re.escape(word) + r"(?!" + boundary + ")"
                if len(re.findall(pattern, key)) != len(re.findall(pattern, value)):
                    failures.append(f"{code}: glossary identity changed: {word}")
            if value == source[key] and len(key) > 8 and " " in key: unchanged.append(key)
            if key in CRITICAL and value == source[key]: failures.append(f"{code}: critical English label untranslated: {key}")
        letters = [char for value in pack.values() for char in value if char.isalpha()]
        script_letters = sum(any(start <= ord(char) <= end for start, end in BLOCKS[code]) for char in letters)
        script_fraction = script_letters / max(1, len(letters))
        if script_fraction < 0.5: failures.append(f"{code}: unexpectedly low script coverage")
        results.append({"language": code, "strings": len(pack), "bytes": path.stat().st_size, "script_letter_fraction": round(script_fraction, 4), "unchanged_english_labels": unchanged, "structural_pass": len(failures) == before, "semantic_approval": "not_established", "native_review": "required"})
    report = {"source_sha256": sha(source_text), "languages_checked": languages, "results": results, "failures": failures, "limits": "Script/placeholder/glossary integrity cannot establish semantic correctness or native usability."}
    Path(output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"languages": len(results), "strings_per_pack": len(source), "failures": len(failures), "report": str(output)}))
    if failures: raise SystemExit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--languages", nargs="+", choices=LANGUAGES, default=PILOT)
    parser.add_argument("--output", default=str(ROOT / "docs/release/WORKSPACE_LOCALE_VALIDATION.json"))
    args = parser.parse_args()
    validate(args.languages, args.output)
