"""Offline Arabic-script Sindhi publication using Sarvam's document API.

Only public UI labels are submitted. No runtime translation, farmer data, new
payment, or unbounded retries. Resume state and signed URLs stay git-ignored.
"""

import asyncio
import hashlib
import html
import json
import math
import os
import re
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

import httpx
from dotenv import load_dotenv

import generate_sarvam_locales as labels

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://api.sarvam.ai/translate/document/jobs"
STATE = ROOT / ".codex-tmp/sindhi-workspace-document-state.json"
REPORT = ROOT / "output/government/sindhi-workspace-document.json"
MAX_CHARACTERS = 50_000
MAX_CREDITS = 250


def signed_endpoint(value):
    parsed = urlsplit(value)
    approved = (
        parsed.hostname == "api.sarvam.ai" and parsed.path.startswith("/translate/document/")
    ) or parsed.hostname == "saasprodstudiopublicsa.blob.core.windows.net"
    if not approved or parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        raise ValueError("Unapproved provider storage endpoint")
    return value


class Paragraphs(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = {}
        self.current = None

    def handle_starttag(self, tag, attrs):
        if tag != "p":
            return
        row = dict(attrs).get("id", "")
        if self.current is not None or not re.fullmatch(r"row-\d+", row) or row in self.rows:
            raise ValueError("Translated paragraph identifiers changed")
        self.current = row
        self.rows[row] = ""

    def handle_data(self, data):
        if self.current is not None:
            self.rows[self.current] += data

    def handle_endtag(self, tag):
        if tag == "p":
            self.current = None


async def generate(report):
    source_text = (ROOT / "frontend/src/features/product/locales/en.json").read_text(encoding="utf-8")
    glossary_text = (ROOT / "scripts/i18n/glossary.json").read_text(encoding="utf-8")
    source = json.loads(source_text)
    labels.GLOSSARY = json.loads(glossary_text)["preserve"]
    protected = [labels.protect(text) for text in source.values()]
    characters = sum(len(text) for text, _mapping in protected)
    estimate = max(1, math.ceil(characters * 5 / 1000))
    if characters > MAX_CHARACTERS or estimate > MAX_CREDITS:
        raise ValueError("Document translation credit limit exceeded")
    report.update(
        source_characters=sum(map(len, source.values())),
        submitted_text_characters=characters,
        estimated_existing_credits=estimate,
        maximum_existing_credits=MAX_CREDITS,
    )
    document = (
        '<!doctype html><html><head><meta charset="UTF-8"></head><body>'
        + "".join(f'<p id="row-{index}">{html.escape(text)}</p>' for index, (text, _mapping) in enumerate(protected))
        + "</body></html>"
    ).encode()
    document_hash = hashlib.sha256(document).hexdigest()
    load_dotenv(ROOT / "backend/.env")
    key = os.getenv("SARVAM_API_KEY", "").strip()
    if not key:
        raise ValueError("Translation key unavailable")
    async with httpx.AsyncClient(timeout=httpx.Timeout(30, connect=5), follow_redirects=False) as client:

        async def api(method, path="", **kwargs):
            response = await client.request(method, BASE + path, headers={"api-subscription-key": key}, **kwargs)
            report["last_http_status"] = response.status_code
            if response.status_code not in {200, 201, 202}:
                raise RuntimeError("Document provider request unavailable")
            if len(response.content) > 1_048_576:
                raise ValueError("Document provider response too large")
            return response.json()

        if STATE.exists():
            state = json.loads(STATE.read_text(encoding="utf-8"))
            if state["document_sha256"] != document_hash:
                raise ValueError("Resume document changed; no duplicate job created")
        else:
            created = await api(
                "POST",
                json={
                    "source_language_code": "en-IN",
                    "target_language_codes": ["sd-IN"],
                    "original_filename": "krishyak-public-sindhi-workspace.html",
                    "job_name": "Krishyak public Sindhi Arabic workspace",
                    "genre": "NON_FICTION",
                    "use_native_numerals": False,
                    "language_specific_guidelines": {
                        "sd-IN": "Translate every paragraph into clear Sindhi in Arabic Perso-Arabic script, right to left. "
                        "Do not use Devanagari. Preserve every HTML paragraph id, order, and all ZXQ<number>QXZ "
                        "tokens exactly, including Latin spelling and numbers. They represent protected "
                        "product names, scientific units, and interpolation placeholders. Preserve negation, "
                        "uncertainty and warnings. Never add explanations or remove paragraphs."
                    },
                },
            )
            state = {
                "job_id": str(UUID(created["job_id"])),
                "document_sha256": document_hash,
                "upload_url": created["upload_url"],
            }
            labels.atomic_json(STATE, state)
        job = str(UUID(state["job_id"]))
        if state.get("upload_url"):
            response = await client.put(
                signed_endpoint(state["upload_url"]),
                content=document,
                headers={"Content-Type": "text/html", "x-ms-blob-type": "BlockBlob"},
            )
            if response.status_code not in {200, 201, 202}:
                raise RuntimeError("Document upload unavailable")
            await api("POST", "/" + job + "/start")
            state.pop("upload_url")
            labels.atomic_json(STATE, state)
        report["status"] = "running"
        print(json.dumps(report), flush=True)
        for _ in range(80):
            await asyncio.sleep(15)
            result = await api("GET", "/" + job + "/live-status")
            row = next(
                (item for item in result.get("translations", []) if item.get("target_language_code") == "sd-IN"), {}
            )
            status = row.get("state", result.get("job_state"))
            print(json.dumps({"translation_state": status}), flush=True)
            if status == "Completed":
                break
            if status == "Failed":
                raise RuntimeError("Document translation failed")
        else:
            raise TimeoutError("Document translation deadline reached; resume state preserved")
        await api("POST", "/" + job + "/export", params={"lang": "sd-IN"})
        for _ in range(20):
            await asyncio.sleep(15)
            exported = await api("GET", "/" + job + "/export/status", params={"lang": "sd-IN"})
            if exported.get("export_state") == "Completed":
                break
            if exported.get("export_state") == "Failed":
                raise RuntimeError("Document export failed")
        else:
            raise TimeoutError("Document export deadline reached")
        response = await client.get(signed_endpoint(exported["download_url"]))
        if response.status_code != 200 or len(response.content) > 2_097_152:
            raise ValueError("Invalid translated document")
        parser = Paragraphs()
        parser.feed(response.content.decode("utf-8"))
        expected = {f"row-{index}" for index in range(len(source))}
        if set(parser.rows) != expected or parser.current is not None:
            raise ValueError("Translated document key set changed")
        pack = {
            key: labels.restore(parser.rows[f"row-{index}"], original, protected[index][1])
            for index, (key, original) in enumerate(source.items())
        }
        letters = [char for value in pack.values() for char in value if char.isalpha()]
        fraction = sum(0x600 <= ord(char) <= 0x6FF for char in letters) / max(1, len(letters))
        if fraction < 0.5:
            raise ValueError("Sindhi Arabic script coverage failed")
        output = ROOT / "frontend/public/locales/workspace"
        labels.atomic_json(output / "sd.json", pack)
        labels.atomic_json(
            output / "sd.meta.json",
            {
                "provider": "Sarvam",
                "model": "provider-managed-document-translation",
                "method": "document_translation_arabic_script_guidelines",
                "api": "/translate/document/jobs",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "source_sha256": labels.digest(source_text),
                "glossary_sha256": labels.digest(glossary_text),
                "pack_sha256": labels.digest((output / "sd.json").read_text(encoding="utf-8")),
                "strings": len(pack),
                "review_status": "machine_translated_needs_native_review",
            },
        )
        report.update(status="published", strings=len(pack), arabic_script_fraction=round(fraction, 4))


async def main():
    report = {"scope": "Public Sindhi UI labels only; existing credits; no purchase"}
    try:
        await generate(report)
    except Exception as error:
        report.update(status="not_published", failure_class=type(error).__name__)
        raise SystemExit(1) from None
    finally:
        labels.atomic_json(REPORT, report)
        print(json.dumps(report), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
