"""Freeze provider aliases and record identities; never infer live availability."""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from config import CROPS  # noqa: E402

aliases = {"Tur": "pigeon_pea", "Arhar": "pigeon_pea", "Gram": "chickpea", "Chickpea": "chickpea"}
names = list(CROPS) + ["Blueberry", "Cherry", "Peach", "Raspberry", "Squash", "Strawberry"]
labels = {"pigeon_pea": "Pigeon pea (Tur / Arhar)", "chickpea": "Chickpea (Gram)",
          "bajra": "Pearl millet (Bajra)", "jowar": "Sorghum (Jowar)", "ragi": "Finger millet (Ragi)"}
photo_aliases = {"grapes": "grape", "capsicum": "pepper"}
priority = "wheat rice mustard chickpea cotton maize sugarcane soybean groundnut tomato potato onion chilli bajra jowar ragi".split()
rows = {}
for name in names:
    identity = aliases.get(name, name.lower().replace(" ", "_"))
    if identity not in rows:
        rows[identity] = {"id": identity, "label": labels.get(identity, name), "name": name,
                          "aliases": [], "planning_names": [], "photo_name": photo_aliases.get(identity, identity),
                          "market_commodity": name}
    rows[identity]["aliases"].append(name)
    if name in CROPS:
        rows[identity]["planning_names"].append(name)
catalog = sorted(rows.values(), key=lambda row: (priority.index(row["id"]) if row["id"] in priority else 100, row["label"]))
content = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
for destination in [ROOT / "backend/v2/crop_catalog.json", ROOT / "frontend/src/features/product/cropCatalog.json"]:
    destination.write_text(content, encoding="utf-8", newline="\n")
print(f"Published {len(catalog)} crop identities; provider names remain separate.")
