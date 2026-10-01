"""One-time, resumable Sarvam UI translation. No runtime translation endpoint.

Run from the repository root: backend/venv/Scripts/python backend/generate_sarvam_locales.py
Only changed source strings incur calls on subsequent runs. Packs publish atomically
only after every string and interpolation placeholder has been validated.
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import time
from collections import Counter
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'frontend/src/i18n/locales/sarvam'
CACHE = ROOT / '.codex-tmp/sarvam-translations'
LANGUAGES = 'hi bn gu kn ml mr or pa ta te as brx doi kok ks mai mni ne sa sat sd ur'.split()
MODEL = 'sarvam-translate:v1'
PLACEHOLDERS = re.compile(r'\{\{\w+\}\}')
# Sarvam sometimes pads the marker's run of zeroes. The nonzero prefix and
# ordered numeric suffix still identify each boundary unambiguously.
BATCH_MARKER = re.compile(r'\[90{7,}([0-9]{1,2})\]')


def leaves(value, prefix=()):
    if isinstance(value, dict):
        for key, child in value.items():
            yield from leaves(child, prefix + (key,))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from leaves(child, prefix + (index,))
    elif isinstance(value, str):
        yield prefix, value


def put(tree, path, value):
    for key in path[:-1]:
        tree = tree[key]
    tree[path[-1]] = value


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps(value, ensure_ascii=False, indent=2) + '\n'
    if path.exists() and path.read_text(encoding='utf-8') == content:
        return
    temp = path.with_suffix('.tmp')
    temp.write_text(content, encoding='utf-8')
    for attempt in range(8):
        try:
            temp.replace(path)
            return
        except PermissionError:
            if attempt == 7: raise
            time.sleep(0.1 * (attempt + 1))


def protect(text):
    mapping = {}
    def replace(match):
        token = f'ZXQ{len(mapping)}QXZ'
        mapping[token] = match.group()
        return token
    return PLACEHOLDERS.sub(replace, text), mapping


def restore(text, source, mapping):
    for token, placeholder in mapping.items():
        if text.count(token) != 1:
            raise ValueError('Translation changed an interpolation marker')
        text = text.replace(token, placeholder)
    if Counter(PLACEHOLDERS.findall(text)) != Counter(PLACEHOLDERS.findall(source)) or not text.strip():
        raise ValueError('Translation placeholders/empty response failed validation')
    return text.strip()


async def generate(args):
    load_dotenv(ROOT / 'backend/.env')
    load_dotenv(ROOT / '.env')
    key = os.getenv('SARVAM_API_KEY', '').strip()
    if not key:
        raise RuntimeError('Set SARVAM_API_KEY in backend/.env')
    source_path = Path(args.source) if args.source else ROOT / 'frontend/src/i18n/locales/en.json'
    output_path = Path(args.output) if args.output else OUT
    source_text = source_path.read_text(encoding='utf-8')
    source = json.loads(source_text)
    strings = list(dict.fromkeys(value for _, value in leaves(source)))
    selected = args.languages or LANGUAGES
    if set(selected) - set(LANGUAGES):
        raise ValueError('Unknown language')
    semaphore = asyncio.Semaphore(args.workers)
    requests = 0
    dispatch_lock = asyncio.Lock()
    last_dispatch = 0.0

    async with httpx.AsyncClient(timeout=60) as client:
        async def translate(text, language):
            nonlocal requests, last_dispatch
            if len(text) > 2000:
                raise ValueError('Source exceeds Sarvam character limit')
            async with semaphore:
                for attempt in range(8):
                    async with dispatch_lock:
                        await asyncio.sleep(max(0, 1.5 - (time.monotonic() - last_dispatch)))
                        last_dispatch = time.monotonic()
                    requests += 1
                    response = await client.post('https://api.sarvam.ai/translate',
                        headers={'api-subscription-key': key}, json={
                            'input': text, 'source_language_code': 'en-IN',
                            'target_language_code': ('od' if language == 'or' else language) + '-IN',
                            'model': MODEL, 'mode': 'formal', 'numerals_format': 'international'})
                    if response.status_code in (429, 502, 503, 504) and attempt < 7:
                        try: delay = float(response.headers.get('retry-after', 15 * (attempt + 1)))
                        except ValueError: delay = 30
                        print(f'{language}: provider busy; pausing before retry', flush=True)
                        await asyncio.sleep(min(60, max(5, delay)))
                        continue
                    if response.status_code >= 400:
                        raise RuntimeError(f'Sarvam translation HTTP {response.status_code}; response body withheld')
                    value = response.json().get('translated_text')
                    if not isinstance(value, str):
                        raise ValueError('Invalid translation response')
                    return value

        async def language_pack(language):
            cache_file = CACHE / (language + '.json')
            cache = json.loads(cache_file.read_text(encoding='utf-8')) if cache_file.exists() else {}
            def cache_key(text): return digest(MODEL + '\0' + language + '\0' + text)
            pending = [s for s in strings if cache_key(s) not in cache]
            # Batch independent labels with stable markers; reject any changed/missing
            # boundary, then retry those labels individually. Never guess alignment.
            while pending:
                batch, size = [], 0
                while pending:
                    s = pending[0]
                    if not s.strip() or s == 'Krishyak' or re.fullmatch(r'[\d\s\W]+', s) or '@' in s and ' ' not in s:
                        cache[cache_key(s)] = s; pending.pop(0); continue
                    protected, mapping = protect(s)
                    line = f'[90000000{len(batch)}] {protected}'
                    if batch and (size + len(line) + 1 > 1800 or len(batch) >= 20): break
                    pending.pop(0); batch.append((s, mapping, line)); size += len(line) + 1
                if not batch: continue
                raw = await translate('\n'.join(item[2] for item in batch), language)
                matches = list(BATCH_MARKER.finditer(raw))
                values = []
                try:
                    if [int(m.group(1)) for m in matches] != list(range(len(batch))): raise ValueError('Batch markers changed')
                    for index, (s, mapping, _) in enumerate(batch):
                        value = raw[matches[index].end():matches[index+1].start() if index+1 < len(matches) else len(raw)]
                        try:
                            cache[cache_key(s)] = restore(value, s, mapping)
                        except ValueError:
                            pass
                    atomic_json(cache_file, cache)
                    if any(cache_key(s) not in cache for s, _, _ in batch):
                        raise ValueError('Retry only rejected labels, not the whole batch')
                    values = [cache[cache_key(s)] for s, _, _ in batch]
                except ValueError:
                    values = []
                    for s, mapping, _ in batch:
                        if cache_key(s) in cache:
                            values.append(cache[cache_key(s)])
                            continue
                        protected, _ = protect(s)
                        raw_single = await translate(protected, language)
                        try:
                            value = restore(raw_single, s, mapping)
                        except ValueError:
                            # Some languages transliterate sentinel tokens. Translate
                            # text spans separately, preserving every placeholder at
                            # its exact structural position rather than guessing.
                            spans = re.split(r'(\{\{\w+\}\})', s)
                            translated_spans = []
                            for span in spans:
                                if PLACEHOLDERS.fullmatch(span) or not span.strip():
                                    translated_spans.append(span)
                                else:
                                    span_key = cache_key(span)
                                    if span_key not in cache:
                                        cache[span_key] = await translate(span, language)
                                        atomic_json(cache_file, cache)
                                    left = span[:len(span)-len(span.lstrip())]
                                    right = span[len(span.rstrip()):]
                                    translated_spans.append(left + cache[span_key].strip() + right)
                            value = restore(''.join(translated_spans), s, {})
                        values.append(value)
                        cache[cache_key(s)] = value
                        atomic_json(cache_file, cache)
                for (s, _, _), value in zip(batch, values): cache[cache_key(s)] = value
                atomic_json(cache_file, cache)
                print(f'{language}: {len(strings)-len(pending)}/{len(strings)} unique strings', flush=True)
            translated = json.loads(json.dumps(source))
            for path, s in leaves(source):
                value = cache[cache_key(s)]
                if Counter(PLACEHOLDERS.findall(value)) != Counter(PLACEHOLDERS.findall(s)):
                    raise ValueError('Cached placeholder mismatch')
                put(translated, path, value)
            atomic_json(output_path / (language + '.json'), translated)
            atomic_json(output_path / (language + '.meta.json'), {'provider': 'Sarvam', 'model': MODEL,
                        'source_sha256': digest(source_text),
                        'pack_sha256': digest((output_path / (language + '.json')).read_text(encoding='utf-8')),
                        'strings': len(list(leaves(source))), 'review_status': 'machine_translated_needs_native_review'})
            print(f'Published {language}', flush=True)
        # A small fixed worker pool avoids uncontrolled API spend/concurrency.
        queue = asyncio.Queue()
        for language in selected: queue.put_nowait(language)
        async def worker():
            while not queue.empty():
                language = queue.get_nowait()
                await language_pack(language)
        await asyncio.gather(*(worker() for _ in range(min(args.workers, len(selected)))))
    print(f'Complete: {len(selected)} packs; {requests} provider requests', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--languages', nargs='+')
    parser.add_argument('--workers', type=int, choices=range(1, 5), default=3)
    parser.add_argument('--source', help='Optional additive locale source; preserve main UI packs')
    parser.add_argument('--output', help='Optional output directory for additive locale packs')
    asyncio.run(generate(parser.parse_args()))
