"""Canonical India location identities from the dated official LGD snapshot."""

import json
import unicodedata
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("india_locations.json").read_text(encoding="utf-8"))
STATES = {row["code"]: row for row in CATALOG["states"]}
DISTRICTS = {row["code"]: row for row in CATALOG["districts"]}


def normalized_name(value):
    return " ".join(unicodedata.normalize("NFKC", value or "").casefold().split())


def name_index(rows, *, district=False):
    index = {}
    for row in rows:
        for name in {row["name"], row["local_name"]} - {""}:
            key = (row["state_code"], normalized_name(name)) if district else normalized_name(name)
            index.setdefault(key, set()).add(row["code"])
    return index


STATE_NAMES = name_index(CATALOG["states"])
# Explicit spelling/script aliases from the India-first input requirements.
STATE_NAMES["rajsthan"] = {8}
STATE_NAMES["राजस्थान"] = {8}
DISTRICT_NAMES = name_index(CATALOG["districts"], district=True)


def resolve_location(state_code=None, district_code=None, state=None, district=None):
    state_key, district_key = normalized_name(state), normalized_name(district)
    if state_code is None and state_key:
        candidates = STATE_NAMES.get(state_key, set())
        if len(candidates) != 1:
            raise ValueError("Select a recognized Indian state or union territory")
        state_code = next(iter(candidates))
    if state_code is not None:
        if state_code not in STATES or (state_key and state_code not in STATE_NAMES.get(state_key, set())):
            raise ValueError("State code and name do not match the location catalogue")
    if district_key or district_code is not None:
        if state_code is None:
            raise ValueError("Select a state before its district")
        candidates = DISTRICT_NAMES.get((state_code, district_key), set())
        if district_code is None:
            if len(candidates) != 1:
                raise ValueError("Select a recognized district within the selected state")
            district_code = next(iter(candidates))
        row = DISTRICTS.get(district_code)
        if row is None or row["state_code"] != state_code or (district_key and district_code not in candidates):
            raise ValueError("District code and name do not match the selected state")
    return {
        "state_code": state_code,
        "district_code": district_code,
        "state": STATES[state_code]["name"] if state_code is not None else None,
        "district": DISTRICTS[district_code]["name"] if district_code is not None else None,
    }
