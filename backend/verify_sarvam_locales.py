"""Offline verification of every generated Sarvam pack; never calls a paid API."""
import json
import re
from collections import Counter

from generate_sarvam_locales import ROOT, OUT, LANGUAGES, PLACEHOLDERS, digest, leaves


def verify():
    source_text = (ROOT / 'frontend/src/i18n/locales/en.json').read_text(encoding='utf-8')
    expected = dict(leaves(json.loads(source_text)))
    report = {}
    for language in LANGUAGES:
        text = (OUT / (language + '.json')).read_text(encoding='utf-8')
        metadata = json.loads((OUT / (language + '.meta.json')).read_text(encoding='utf-8'))
        assert metadata['source_sha256'] == digest(source_text), f'{language}: stale source'
        assert metadata['pack_sha256'] == digest(text), f'{language}: changed pack'
        actual = dict(leaves(json.loads(text)))
        assert actual.keys() == expected.keys(), f'{language}: missing/extra keys'
        for path, value in actual.items():
            assert value.strip(), f'{language}.{path}: empty'
            assert Counter(PLACEHOLDERS.findall(value)) == Counter(PLACEHOLDERS.findall(expected[path])), f'{language}.{path}: placeholders'
            assert not re.search(r'ZXQ\d+QXZ|\[K\d{4}\]|\[90{7,}\d+\]', value), f'{language}.{path}: leaked batch marker'
        report[language] = {'strings': len(actual), 'identical_to_english': sum(v == expected[k] for k, v in actual.items())}
    return report


if __name__ == '__main__':
    report = verify()
    print(json.dumps({'verified_languages': len(report), 'packs': report}, indent=2))
