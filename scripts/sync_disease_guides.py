"""Copy the reviewed disease guidance into the app bundle for the offline guide library.

Run after editing backend/v2/disease_guidance.json. A Jest test fails when the
two files drift apart.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PHOTO_NAMES = ["tomato", "potato", "apple", "cherry", "grape", "orange", "peach", "pepper", "squash", "strawberry"]


def photo_name(label):
    name = label.split("___")[0].casefold()
    return "maize" if "corn" in name else next(crop for crop in PHOTO_NAMES if crop in name)


def build():
    source = json.loads((ROOT / "backend/v2/disease_guidance.json").read_text(encoding="utf-8"))
    crops = {}
    for label, entry in source["classes"].items():
        crops.setdefault(photo_name(label), []).append(
            {
                "label": label,
                "name": entry["name"],
                "cause": entry["cause"],
                "urgent": bool(entry.get("urgent")),
                "steps": entry["steps"],
            }
        )
    return {
        "review_status": source["_meta"]["review_status"],
        "common_steps": source["common_steps"],
        "crops": dict(sorted(crops.items())),
    }


if __name__ == "__main__":
    target = ROOT / "frontend/src/features/product/diseaseGuides.json"
    target.write_text(json.dumps(build(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {target.relative_to(ROOT)}")
