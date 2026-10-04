"""Publish an inspected official LGD snapshot without live provider calls."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    snapshot = json.loads(args.source.read_text(encoding="utf-8"))
    states = [
        {
            "code": row["stateCode"],
            "name": row["stateNameEnglish"].strip(),
            "local_name": (row.get("stateNameLocal") or "").strip(),
        }
        for row in snapshot["states"]
    ]
    districts = [
        {
            "code": row["districtCode"],
            "state_code": row["stateCode"],
            "name": row["districtNameEnglish"].strip(),
            "local_name": (row.get("districtNameLocal") or "").strip(),
        }
        for row in snapshot["districts"]
    ]
    assert len({row["code"] for row in states}) == len(states)
    assert len({row["code"] for row in districts}) == len(districts)
    assert all(
        row["state_code"] in {state["code"] for state in states} for row in districts
    )
    assert all(
        any(row["state_code"] == state["code"] for row in districts) for state in states
    )
    states.sort(key=lambda row: row["name"].casefold())
    districts.sort(key=lambda row: (row["state_code"], row["name"].casefold()))
    catalog = {"states": states, "districts": districts}
    content = json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"
    # Migration backfill remains reproducible when the runtime catalog changes.
    frozen = ROOT / "backend/migrations/data/v2_0006_locations.json"
    frozen.parent.mkdir(parents=True, exist_ok=True)
    if frozen.exists() and json.loads(frozen.read_text(encoding="utf-8")) != catalog:
        raise SystemExit("Refusing to change a historical migration's frozen catalog")
    for target in [
        ROOT / "backend/v2/india_locations.json",
        ROOT / "frontend/src/features/product/indiaLocations.json",
    ]:
        target.write_text(content, encoding="utf-8", newline="\n")
    frozen.write_text(content, encoding="utf-8", newline="\n")
    provenance = {
        "source": snapshot["source"],
        "retrieved_at": snapshot["retrieved_at"],
        "catalogue_url": "https://data.gov.in/catalog/local-government-directory-lgd",
        "code_namespace": "LGD; not Census 2011 or postal codes",
        "state_source_url": "https://lgdirectory.gov.in/webservices/lgdws/stateList",
        "states": len(states),
        "districts": len(districts),
        "catalog_sha256": hashlib.sha256(content.encode("utf-8")).hexdigest(),
        "source_snapshot_sha256": hashlib.sha256(args.source.read_bytes()).hexdigest(),
        "source_snapshot_file": args.source.name,
        "receipts": snapshot["receipts"],
        "limitations": [
            "A dated provider snapshot; administrative changes require review and refresh.",
            "Official local names may be missing or identical to English.",
            "No village, tehsil or PIN-code mapping is inferred.",
            "Codes do not verify residence, land ownership or scheme eligibility.",
        ],
    }
    (ROOT / "backend/v2/india_locations.meta.json").write_text(
        json.dumps(provenance, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"Published {len(states)} LGD states/UTs and {len(districts)} districts")


if __name__ == "__main__":
    main()
