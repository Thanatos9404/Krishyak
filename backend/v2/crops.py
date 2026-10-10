"""Language-independent record identities with explicit provider aliases."""

import json
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("crop_catalog.json").read_text(encoding="utf-8"))
BY_ID = {row["id"]: row for row in CATALOG}
BY_NAME = {name: row for row in CATALOG for name in row["aliases"]}


def resolve_crop(crop_id, name):
    row = BY_ID.get(crop_id) if crop_id is not None else BY_NAME.get(name)
    if row is None or (name is not None and name not in row["aliases"]):
        raise ValueError("Choose a supported crop; crop ID and name must match")
    return row["id"], name or row["name"]
