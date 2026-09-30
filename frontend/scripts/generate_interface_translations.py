#!/usr/bin/env python3
"""Generate lazy, static translations for every literal UI key used by Krishyak."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np

from generate_catalog_translations import (
    LOCALES,
    ROOT,
    TARGET_LANGUAGES,
    load_existing_packs,
    load_model,
)


OUTPUT = LOCALES / "generated"
KEY_PATTERN = re.compile(r"\bt\(\s*['\"]([^'\"]+)['\"]")
PLACEHOLDER_PATTERN = re.compile(r"\{\{(\w+)\}\}")
KEEP_AS_IS = {"app.name", "privacy.contact", "terms.contact"}


def collect_visible_keys() -> list[str]:
    keys: set[str] = set()
    for file in (ROOT / "src").rglob("*"):
        if file.suffix not in {".js", ".jsx"} or file.name.endswith(".test.js"):
            continue
        keys.update(KEY_PATTERN.findall(file.read_text(encoding="utf-8")))
    return sorted(keys)


def get_nested(source: dict, key: str):
    value = source
    for part in key.split("."):
        if not isinstance(value, dict) or part not in value:
            return None
        value = value[part]
    return value


def set_nested(target: dict, key: str, value: str) -> None:
    node = target
    parts = key.split(".")
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def protect_placeholders(value: str) -> tuple[str, dict[str, str]]:
    replacements: dict[str, str] = {}
    markers = ["999999999", "888888888", "777777777", "666666666", "555555555"]

    def replace(match: re.Match[str]) -> str:
        token = markers[len(replacements)]
        replacements[token] = match.group(0)
        return token

    return PLACEHOLDER_PATTERN.sub(replace, value), replacements


def restore_placeholders(value: str, replacements: dict[str, str]) -> str:
    restored = value
    for token, placeholder in replacements.items():
        restored = restored.replace(token, placeholder)
        if placeholder not in restored:
            for match in re.finditer(r"\d(?:[\d\s,،.٬]*\d)?", restored):
                if sum(char.isdigit() for char in match.group(0)) >= 5:
                    restored = restored[: match.start()] + placeholder + restored[match.end() :]
                    break
    return restored


def past_feed(past_outputs: list[np.ndarray], layers: int) -> dict[str, np.ndarray]:
    result = {}
    for index in range(layers):
        offset = index * 4
        result[f"past_key_values.{index}.decoder.key"] = past_outputs[offset]
        result[f"past_key_values.{index}.decoder.value"] = past_outputs[offset + 1]
        result[f"past_key_values.{index}.encoder.key"] = past_outputs[offset + 2]
        result[f"past_key_values.{index}.encoder.value"] = past_outputs[offset + 3]
    return result


def translate_batch(model, texts: list[str], target: str, max_new_tokens: int = 128) -> list[str]:
    if hasattr(model._ip, "_placeholder_entity_maps"):
        model._ip._placeholder_entity_maps.queue.clear()
    protected = [protect_placeholders(text) for text in texts]
    source_texts = [item[0] for item in protected]
    prefixed = model._ip.preprocess_batch(source_texts, src_lang="eng_Latn", tgt_lang=target)
    encoded = model._src_tok.encode_batch(prefixed)
    max_length = max(len(item.ids) for item in encoded)
    pad_id = 1
    unk_id = model._meta["unk_id"]
    input_ids = np.full((len(encoded), max_length), pad_id, dtype=np.int64)
    attention = np.zeros((len(encoded), max_length), dtype=np.int64)
    for row, item in enumerate(encoded):
        safe_ids = [token if token < model._meta["src_dict_size"] else unk_id for token in item.ids]
        input_ids[row, : len(safe_ids)] = safe_ids
        attention[row, : len(item.attention_mask)] = item.attention_mask

    encoder_output = model._enc.run(
        ["last_hidden_state"],
        {"input_ids": input_ids, "attention_mask": attention},
    )[0]
    decoder_ids = np.full((len(encoded), 1), model._decoder_start_id, dtype=np.int64)
    output_ids = [[model._decoder_start_id] for _ in encoded]
    finished = np.zeros(len(encoded), dtype=bool)
    past_outputs = None

    for step in range(max_new_tokens):
        if step == 0:
            decoder_output = model._dec.run(
                None,
                {
                    "input_ids": decoder_ids,
                    "encoder_hidden_states": encoder_output,
                    "encoder_attention_mask": attention,
                },
            )
        else:
            decoder_output = model._dec_past.run(
                None,
                {
                    "input_ids": decoder_ids,
                    "encoder_attention_mask": attention,
                    **past_feed(past_outputs, model._num_layers),
                },
            )
        past_outputs = list(decoder_output[1:])
        next_ids = np.argmax(decoder_output[0][:, -1, :], axis=-1).astype(np.int64)
        next_ids[finished] = model._eos_id
        for row, token in enumerate(next_ids.tolist()):
            output_ids[row].append(token)
        finished |= next_ids == model._eos_id
        if finished.all():
            break
        decoder_ids = next_ids.reshape(-1, 1)

    raw = []
    for row in output_ids:
        safe = [token if token < model._meta["tgt_dict_size"] else unk_id for token in row]
        raw.append(model._tgt_tok.decode(safe, skip_special_tokens=True))
    translated = model._ip.postprocess_batch(raw, lang=target)
    return [
        restore_placeholders(re.sub(r"^[a-z]{3}\s*@\w+\s*", "", value.strip(), flags=re.IGNORECASE), mapping)
        for value, (_, mapping) in zip(translated, protected)
    ]


def chunks(items: list[tuple[str, str]], size: int = 24):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def main() -> None:
    requested = set(sys.argv[1:]) or set(TARGET_LANGUAGES)
    unknown = requested.difference(TARGET_LANGUAGES)
    if unknown:
        raise SystemExit(f"Unknown language codes: {', '.join(sorted(unknown))}")

    english = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    existing = load_existing_packs()
    visible_keys = collect_visible_keys()
    sources: dict[str, str] = {}
    for key in visible_keys:
        value = get_nested(english, key)
        if not isinstance(value, str) or not value.strip():
            raise RuntimeError(f"English UI key is missing or empty: {key}")
        sources[key] = value

    model = load_model()
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for code, target in TARGET_LANGUAGES.items():
        if code not in requested:
            continue
        missing = [
            (key, value)
            for key, value in sources.items()
            if not isinstance(get_nested(existing.get(code, {}), key), str)
            or not get_nested(existing.get(code, {}), key).strip()
        ]
        patch: dict = {}
        for key, value in missing:
            if key in KEEP_AS_IS:
                set_nested(patch, key, value)

        translatable = [(key, value) for key, value in missing if key not in KEEP_AS_IS]
        for batch in chunks(translatable):
            translated = translate_batch(model, [value for _, value in batch], target)
            for (key, source), value in zip(batch, translated):
                if not value:
                    raise RuntimeError(f"Empty translation for {code}.{key}: {source}")
                expected = set(PLACEHOLDER_PATTERN.findall(source))
                actual = set(PLACEHOLDER_PATTERN.findall(value))
                for missing_placeholder in sorted(expected.difference(actual)):
                    value = f"{value} {{{{{missing_placeholder}}}}}"
                set_nested(patch, key, value)

        (OUTPUT / f"{code}.json").write_text(
            json.dumps(patch, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"Translated {code}: {len(translatable)} UI strings", flush=True)


if __name__ == "__main__":
    main()
