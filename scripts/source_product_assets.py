"""Download selected licensed public assets and create bounded responsive images.

Run explicitly; builds never contact photo or font services. Originals stay in
ignored output/. Only optimized derivatives and provenance are shipped.
"""

import hashlib
import io
import json
import re
from pathlib import Path

import httpx
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"
PHOTOS = [
    ("fields", 2468400, "Tom Fisk", "aerial-photography-of-green-rice-field", "Aerial view of green rice fields in Indonesia"),
    ("farmers", 20344348, "EqualStock IN", "farmers-in-india", "Two women working in a green agricultural field in India"),
    ("tomatoes", 33474156, "Nurullah Karaman", "fresh-red-tomato-on-a-vine-in-garden-setting", "A ripe tomato growing on a vine among green leaves"),
    ("market", 23884776, "Robert Stokoe", "vegetable-market-in-india", "Produce displayed at a street market in India"),
    ("terraces", 68491, "shy sol", "green-rice-terraces", "Green terraced rice fields seen from above"),
    ("community", 19911960, "Beyond India by Shubham Thakur", "people-working-on-field", "Farmers working together in a field in Mungeli, India"),
    ("fieldwork", 18065034, "Pranjal Mulane", "farmer-working-in-field", "A woman working among crops in Nashik, India"),
]
FONTS = ["Geologica", "Noto Sans Devanagari", "Noto Sans Bengali", "Noto Sans Tamil", "Noto Sans Telugu", "Noto Sans Gujarati", "Noto Sans Gurmukhi", "Noto Sans Kannada", "Noto Sans Malayalam", "Noto Sans Arabic", "Noto Sans Oriya", "Noto Sans Ol Chiki", "Noto Sans Meetei Mayek"]


def main():
    images = PUBLIC / "images"
    fonts = PUBLIC / "fonts"
    originals = ROOT / "output" / "product" / "originals"
    for directory in (images, fonts, originals):
        directory.mkdir(parents=True, exist_ok=True)
    records = []
    with httpx.Client(timeout=40, follow_redirects=True) as client:
        for name, photo_id, author, slug, alt in PHOTOS:
            url = f"https://images.pexels.com/photos/{photo_id}/pexels-photo-{photo_id}.jpeg?auto=compress&cs=tinysrgb&w=2000"
            original_path = originals / f"{name}.jpg"
            source_bytes = original_path.read_bytes() if original_path.exists() else client.get(url).raise_for_status().content
            if len(source_bytes) > 15_000_000:
                raise ValueError("Unexpectedly large source image")
            original = ImageOps.exif_transpose(Image.open(io.BytesIO(source_bytes))).convert("RGB")
            original_path.write_bytes(source_bytes)
            sizes = []
            for width in (400, 800, 1440):
                image = original.copy()
                image.thumbnail((width, 2000), Image.Resampling.LANCZOS)
                if name == "fields":
                    image = ImageOps.fit(original, (width, round(width / 2.5)), Image.Resampling.LANCZOS)
                path = images / f"{name}-{width}.webp"
                image.save(path, "WEBP", quality=62 if name == "fields" else 73, method=6)
                sizes.append({"src": f"/images/{path.name}", "width": image.width, "height": image.height, "bytes": path.stat().st_size})
            records.append({"name": name, "author": author, "page": f"https://www.pexels.com/photo/{slug}-{photo_id}/", "license": "https://www.pexels.com/license/", "alt": alt, "original_sha256": hashlib.sha256(source_bytes).hexdigest(), "sizes": sizes})
        css = ["/* Self-hosted Google Fonts, SIL Open Font License; only used scripts download. */"]
        font_records = []
        for family in FONTS:
            query = family.replace(" ", "+")
            response = client.get(f"https://fonts.googleapis.com/css2?family={query}:wght@400;500;600;700&display=swap", headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"})
            response.raise_for_status()
            font_css = response.text
            # Each unicode subset is fetched once even when multiple weights share it.
            for url in dict.fromkeys(re.findall(r"https://fonts\.gstatic\.com/[^)]+", font_css)):
                file_name = family.lower().replace(" ", "-") + "-" + hashlib.sha256(url.encode()).hexdigest()[:10] + ".woff2"
                blob = client.get(url)
                blob.raise_for_status()
                if blob.content[:4] != b"wOF2":
                    raise ValueError("Google Fonts returned an unoptimized font")
                (fonts / file_name).write_bytes(blob.content)
                font_css = font_css.replace(url, f"/fonts/{file_name}")
                font_records.append({"family": family, "source": url, "path": f"/fonts/{file_name}", "bytes": len(blob.content)})
            css.append(font_css)
            license_url = f"https://raw.githubusercontent.com/google/fonts/main/ofl/{family.lower().replace(' ', '')}/OFL.txt"
            license_response = client.get(license_url)
            license_response.raise_for_status()
            (PUBLIC / "licenses").mkdir(exist_ok=True)
            license_text = "\n".join(line.rstrip() for line in license_response.text.splitlines()) + "\n"
            (PUBLIC / "licenses" / f"{family.lower().replace(' ', '-')}-OFL.txt").write_text(license_text, encoding="utf-8")
        (ROOT / "frontend" / "src" / "design").mkdir(exist_ok=True)
        (ROOT / "frontend" / "src" / "design" / "fonts.css").write_text("\n".join(css), encoding="utf-8")
    (PUBLIC / "asset-provenance.json").write_text(json.dumps({"retrieved_on": "2026-10-03", "photos": records, "fonts": font_records, "font_license": "https://github.com/google/fonts/blob/main/ofl/geologica/OFL.txt", "usage": "Illustrative photography; depicted people do not endorse or use Krishyak. No stock photo is a farmer account or founder portrait."}, indent=2), encoding="utf-8")
    print(json.dumps({"photos": len(records), "photo_bytes": sum(row["bytes"] for record in records for row in record["sizes"]), "font_files": len(font_records), "font_bytes": sum(row["bytes"] for row in font_records)}))


if __name__ == "__main__":
    main()
