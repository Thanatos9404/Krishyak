"""Build the original social card and PWA icons from licensed/local assets."""
from pathlib import Path
import httpx
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "frontend" / "public"


def main():
    font_path = ROOT / "output" / "product" / "originals" / "geologica-display.ttf"
    if not font_path.exists():
        font_path.parent.mkdir(parents=True, exist_ok=True)
        response = httpx.get("https://raw.githubusercontent.com/google/fonts/main/ofl/geologica/Geologica%5BCRSV%2CSHRP%2Cslnt%2Cwght%5D.ttf", follow_redirects=True, timeout=30)
        response.raise_for_status()
        font_path.write_bytes(response.content)
    card = Image.new("RGB", (1200, 630), "#f7f6f0")
    photo = Image.open(PUBLIC / "images" / "fields-1440.webp")
    card.paste(ImageOps.fit(photo, (1200, 250), Image.Resampling.LANCZOS), (0, 380))
    draw = ImageDraw.Draw(card)
    draw.text((64, 36), "krishyak.", font=ImageFont.truetype(str(font_path), 38), fill="#214b3a")
    draw.text((64, 112), "Your farm.", font=ImageFont.truetype(str(font_path), 78), fill="#20392d")
    draw.text((64, 200), "A clearer view.", font=ImageFont.truetype(str(font_path), 78), fill="#214b3a")
    draw.text((68, 308), "Field evidence. Human judgement.", font=ImageFont.truetype(str(font_path), 26), fill="#5b675d")
    card.save(PUBLIC / "og-image.png", optimize=True)
    for size in (192, 512):
        scale = size / 64
        icon = Image.new("RGB", (size, size), "#214b3a")
        painter = ImageDraw.Draw(icon)
        def points(values):
            return [(round(x * scale), round(y * scale)) for x, y in values]
        width = round(2.7 * scale)
        painter.line(points([(18, 48), (18, 22)]), fill="#f7f6f0", width=width)
        painter.line(points([(18, 39), (19, 31), (24, 23), (33, 17), (48, 14), (47, 25), (42, 34), (33, 39), (18, 39)]), fill="#f7f6f0", width=width, joint="curve")
        painter.line(points([(20, 38), (38, 24)]), fill="#c9d6a9", width=width)
        painter.line(points([(27, 46), (47, 46)]), fill="#f7f6f0", width=width)
        painter.line(points([(27, 53), (52, 53)]), fill="#f7f6f0", width=width)
        icon.save(PUBLIC / f"icon-{size}.png", optimize=True)
    print("Built 1200x630 original share card and 192/512 PWA icons")


if __name__ == "__main__":
    main()
