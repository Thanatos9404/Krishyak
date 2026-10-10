"""Offline validation of additive EO packs; no external calls."""
import json
from collections import Counter

from generate_sarvam_locales import ROOT, LANGUAGES, PLACEHOLDERS, digest, leaves


def verify():
    directory = ROOT / 'frontend/src/i18n/locales/remote-sensing'
    source = (directory / 'en.json').read_text(encoding='utf-8')
    expected = dict(leaves(json.loads(source)))
    for code in LANGUAGES:
        text = (directory / f'{code}.json').read_text(encoding='utf-8')
        meta = json.loads((directory / f'{code}.meta.json').read_text(encoding='utf-8'))
        actual = dict(leaves(json.loads(text)))
        assert meta['source_sha256'] == digest(source), f'{code}: stale source'
        assert meta['pack_sha256'] == digest(text), f'{code}: altered pack'
        assert actual.keys() == expected.keys(), f'{code}: key mismatch'
        for key, value in actual.items():
            assert value.strip(), f'{code}: empty string'
            assert Counter(PLACEHOLDERS.findall(value)) == Counter(PLACEHOLDERS.findall(expected[key])), f'{code}: placeholders'
    return {'languages':len(LANGUAGES), 'strings_per_language':len(expected)}


if __name__ == '__main__':
    print(json.dumps(verify()))
