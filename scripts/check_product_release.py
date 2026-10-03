"""Verify required release documents and licensed public asset integrity."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTS = {
    "product": ["REFERENCE_SITE_ANALYSIS", "DESIGN_SYSTEM", "CONTENT_MAP", "FRONTEND_MIGRATION", "DESIGN_QA", "FARMER_USABILITY_TEST", "FUNDER_DEMO_FLOW", "AGRONOMIST_REVIEW_CHECKLIST", "PERFORMANCE_REPORT", "UI_REBUILD_REPORT"],
    "seo": ["BASELINE_AUDIT", "SEARCH_CONSOLE_HANDOFF", "INDEXABILITY_MATRIX", "FINAL_SEO_REPORT"],
    "growth": ["MEDIA_KIT", "EARNED_MEDIA_OUTREACH"],
}


def main():
    for folder, names in DOCUMENTS.items():
        for name in names:
            path = ROOT / "docs" / folder / f"{name}.md"
            assert path.is_file() and len(path.read_text(encoding="utf-8")) > 200, f"Missing/empty release document {path}"
    public = ROOT / "frontend" / "public"
    manifest = json.loads((public / "asset-provenance.json").read_text(encoding="utf-8"))
    assert len(manifest["photos"]) == 7
    for photo in manifest["photos"]:
        assert photo["author"] and photo["license"] and photo["alt"] and photo["original_sha256"]
        for source in photo["sizes"]:
            image = public / source["src"].removeprefix("/")
            assert image.stat().st_size == source["bytes"], image
            assert source["width"] and source["height"]
            assert image.read_bytes()[:4] == b"RIFF", image
    for font in manifest["fonts"]:
        path = public / font["path"].removeprefix("/")
        assert path.stat().st_size == font["bytes"] and path.read_bytes()[:4] == b"wOF2", path
        license_path = public / "licenses" / (font["family"].lower().replace(" ", "-") + "-OFL.txt")
        assert "SIL OPEN FONT LICENSE" in license_path.read_text(encoding="utf-8")
    print(f"PASS: 16 release documents, 7 licensed photos and {len(manifest['fonts'])} verified WOFF2 files")


if __name__ == "__main__":
    main()
