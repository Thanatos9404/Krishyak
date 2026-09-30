#!/usr/bin/env python3
"""Generate Krishyak's static crop and soil translations with IndicTrans2.

This is an editorial/build-time utility. The generated JavaScript file is
committed with the app; no translation model or network request is shipped to
the browser.
"""

from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

from huggingface_hub import snapshot_download


ROOT = Path(__file__).resolve().parents[1]
LOCALES = ROOT / "src" / "i18n" / "locales"
MODEL_ID = "hari31416/indictrans2-en-indic-dist-200M-ONNX-int8"

TARGET_LANGUAGES = {
    "as": "asm_Beng",
    "bn": "ben_Beng",
    "brx": "brx_Deva",
    "doi": "doi_Deva",
    "gu": "guj_Gujr",
    "hi": "hin_Deva",
    "kn": "kan_Knda",
    "ks": "kas_Arab",
    "kok": "gom_Deva",
    "mai": "mai_Deva",
    "ml": "mal_Mlym",
    "mni": "mni_Mtei",
    "mr": "mar_Deva",
    "ne": "npi_Deva",
    "or": "ory_Orya",
    "pa": "pan_Guru",
    "sa": "san_Deva",
    "sat": "sat_Olck",
    "sd": "snd_Arab",
    "ta": "tam_Taml",
    "te": "tel_Telu",
    "ur": "urd_Arab",
}

SCRIPT_RANGES = {
    "asm_Beng": ((0x0980, 0x09FF),),
    "ben_Beng": ((0x0980, 0x09FF),),
    "brx_Deva": ((0x0900, 0x097F),),
    "doi_Deva": ((0x0900, 0x097F),),
    "guj_Gujr": ((0x0A80, 0x0AFF),),
    "hin_Deva": ((0x0900, 0x097F),),
    "kan_Knda": ((0x0C80, 0x0CFF),),
    "kas_Arab": ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)),
    "gom_Deva": ((0x0900, 0x097F),),
    "mai_Deva": ((0x0900, 0x097F),),
    "mal_Mlym": ((0x0D00, 0x0D7F),),
    "mni_Mtei": ((0xABC0, 0xABFF),),
    "mar_Deva": ((0x0900, 0x097F),),
    "npi_Deva": ((0x0900, 0x097F),),
    "ory_Orya": ((0x0B00, 0x0B7F),),
    "pan_Guru": ((0x0A00, 0x0A7F),),
    "san_Deva": ((0x0900, 0x097F),),
    "sat_Olck": ((0x1C50, 0x1C7F),),
    "snd_Arab": ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)),
    "tam_Taml": ((0x0B80, 0x0BFF),),
    "tel_Telu": ((0x0C00, 0x0C7F),),
    "urd_Arab": ((0x0600, 0x06FF), (0x0750, 0x077F), (0x08A0, 0x08FF)),
}

RETRY_SOURCES = {
    "bajra": "bajra crop",
    "ragi": "ragi crop",
    "lentil": "masoor lentil crop",
    "green peas": "green pea crop",
    "chilli": "hot pepper crop",
    "grapes": "vine fruit",
    "coconut": "coconut palm fruit",
    "turmeric": "yellow turmeric root crop",
    "black pepper": "peppercorn spice crop",
    "pulses": "legume crops",
    "vegetables": "edible garden crops",
}


def load_existing_packs() -> dict[str, dict]:
    packs: dict[str, dict] = {}
    for code in TARGET_LANGUAGES:
        locale_file = LOCALES / f"{code}.json"
        if locale_file.exists():
            packs[code] = json.loads(locale_file.read_text(encoding="utf-8"))

    scheduled_url = (LOCALES / "scheduledLocales.js").as_uri()
    js = (
        f"import packs from {json.dumps(scheduled_url)};"
        "process.stdout.write(JSON.stringify(packs));"
    )
    scheduled = json.loads(
        subprocess.check_output(
            ["node", "--input-type=module", "--eval", js],
            text=True,
            encoding="utf-8",
        )
    )
    packs.update(scheduled)
    return packs


def load_model():
    snapshot = Path(snapshot_download(repo_id=MODEL_ID, local_dir=ROOT.parent / ".catalog-model"))
    spec = importlib.util.spec_from_file_location("krishyak_indictrans_onnx", snapshot / "translate.py")
    if spec is None or spec.loader is None:
        raise RuntimeError("Unable to load IndicTrans2 ONNX helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.IndicTransONNX(snapshot)


def load_generated_catalog() -> dict[str, dict]:
    path = LOCALES / "catalogTranslations.js"
    if not path.exists():
        return {}
    match = re.search(
        r"export const catalogTranslations = (.*);\s*export default catalogTranslations;",
        path.read_text(encoding="utf-8"),
        re.DOTALL,
    )
    return json.loads(match.group(1)) if match else {}


def uses_only_target_script(value: str, target: str) -> bool:
    ranges = SCRIPT_RANGES[target]
    for char in value:
        if char.isalpha() and not any(start <= ord(char) <= end for start, end in ranges):
            return False
    return True


def translate_label(model, source: str, key: str, target: str) -> str:
    simple = re.sub(r"\s*\([^)]*\)\s*", "", source).strip()
    candidates = [simple, RETRY_SOURCES.get(key), f"{simple} crop"]
    for candidate in dict.fromkeys(item for item in candidates if item):
        translated = model.translate(
            candidate,
            src_lang="eng_Latn",
            tgt_lang=target,
            max_new_tokens=32,
        ).strip()
        translated = re.sub(r"^[a-z]{3}\s*@\w+\s*", "", translated, flags=re.IGNORECASE)
        if translated and uses_only_target_script(translated, target):
            return translated
    raise RuntimeError(f"Wrong-script translation for {target}: {key} ({source})")


def main() -> None:
    requested = set(sys.argv[1:]) or set(TARGET_LANGUAGES)
    unknown = requested.difference(TARGET_LANGUAGES)
    if unknown:
        raise SystemExit(f"Unknown language codes: {', '.join(sorted(unknown))}")
    english = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    existing = load_existing_packs()
    model = load_model()
    result: dict[str, dict] = load_generated_catalog()

    for code, target in TARGET_LANGUAGES.items():
        if code not in requested:
            continue
        result[code] = {"crops": {}, "soils": {}}
        for section in ("crops", "soils"):
            for key, source in english[section].items():
                current = existing.get(code, {}).get(section, {}).get(key)
                if isinstance(current, str) and current.strip() and current.strip() != source.strip():
                    translated = current.strip()
                else:
                    translated = translate_label(model, source, key, target)
                if not translated:
                    raise RuntimeError(f"Empty translation for {code}.{section}.{key}")
                result[code][section][key] = translated
        print(f"Translated {code}", flush=True)

    output = (
        "// Generated once with MIT-licensed IndicTrans2; no runtime translation dependency.\n"
        "export const catalogTranslations = "
        + json.dumps(result, ensure_ascii=False, indent=2)
        + ";\n\nexport default catalogTranslations;\n"
    )
    (LOCALES / "catalogTranslations.js").write_text(output, encoding="utf-8")
    print(f"Wrote catalog translations for {len(result)} languages.")


if __name__ == "__main__":
    main()
