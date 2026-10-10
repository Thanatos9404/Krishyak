"""Official snapshot parity, canonical identity and parent validation."""

import hashlib
import json
import unittest
from pathlib import Path

from pydantic import ValidationError

from v2.locations import CATALOG, DISTRICTS, STATES, resolve_location
from v2.schemas import ProfileInput


class IndiaLocationTests(unittest.TestCase):
    def profile(self, **location):
        return ProfileInput(display_name="Test farmer", **location)

    def test_official_codes_have_unique_identities_and_valid_parents(self):
        self.assertEqual(len(STATES), len(CATALOG["states"]))
        self.assertEqual(len(DISTRICTS), len(CATALOG["districts"]))
        for row in CATALOG["districts"]:
            with self.subTest(code=row["code"]):
                result = self.profile(state_code=row["state_code"], district_code=row["code"])
                self.assertEqual(result.district, row["name"])
                self.assertEqual(result.state, STATES[row["state_code"]]["name"])

    def test_case_script_and_explicit_spelling_aliases_share_one_identity(self):
        for name in ["Rajasthan", "rajasthan", " RAJASTHAN ", "राजस्थान", "Rajsthan"]:
            with self.subTest(name=name):
                result = self.profile(state=name, district=" jaipur ")
                self.assertEqual((result.state_code, result.district_code), (8, 102))
                self.assertEqual((result.state, result.district), ("Rajasthan", "Jaipur"))
        result = self.profile(state="महाराष्ट्र", district="नाशिक")
        self.assertEqual((result.state_code, result.district_code), (27, 487))

    def test_mismatched_codes_unknown_names_and_unscoped_districts_are_rejected(self):
        for location in [
            {"state_code": 8, "district_code": 487},
            {"state_code": 27, "state": "Rajasthan"},
            {"state_code": 8, "district_code": 102, "district": "Nashik"},
            {"district": "Jaipur"},
            {"district_code": 102},
            {"state": "Atlantis"},
            {"state_code": 9999},
            {"state_code": 8, "district": "Unknown district"},
            {"state_code": True},
            {"district_code": "102", "state_code": 8},
        ]:
            with self.subTest(location=location), self.assertRaises(ValidationError):
                self.profile(**location)

    def test_repeated_district_names_resolve_only_with_their_state(self):
        names = {}
        for row in CATALOG["districts"]:
            names.setdefault(row["name"].casefold(), []).append(row)
        duplicates = [rows for rows in names.values() if len({row["state_code"] for row in rows}) > 1]
        self.assertTrue(duplicates, "The official snapshot must exercise actual district-name collisions")
        for rows in duplicates:
            for row in rows:
                with self.subTest(code=row["code"]):
                    result = self.profile(state_code=row["state_code"], district=row["name"])
                    self.assertEqual(result.district_code, row["code"])

    def test_optional_location_and_reported_tehsil_village_and_pin_are_not_inferred(self):
        self.assertEqual(
            resolve_location(), {"state_code": None, "district_code": None, "state": None, "district": None}
        )
        result = self.profile(subdistrict="Reported tehsil", village="Reported village", pin_code=" 302001 ")
        self.assertIsNone(result.state_code)
        self.assertEqual(result.pin_code, "302001")
        self.assertEqual(self.profile(pin_code="").pin_code, None)
        for pin in ["000000", "012345", "30200", "3020012", "ABCDEF", "३०२००१"]:
            with self.subTest(pin=pin), self.assertRaises(ValidationError):
                self.profile(pin_code=pin)

    def test_frontend_and_frozen_migration_catalogues_match_the_initial_release(self):
        root = Path(__file__).resolve().parents[1]
        frontend = json.loads((root / "frontend/src/features/product/indiaLocations.json").read_text(encoding="utf-8"))
        frozen = json.loads((root / "backend/migrations/data/v2_0006_locations.json").read_text(encoding="utf-8"))
        self.assertEqual(frontend, CATALOG)
        self.assertEqual(frozen, CATALOG)

    def test_published_provenance_hash_and_parent_receipts_cover_the_snapshot(self):
        root = Path(__file__).resolve().parent / "v2"
        meta = json.loads((root / "india_locations.meta.json").read_text(encoding="utf-8"))
        self.assertEqual(
            meta["catalog_sha256"], hashlib.sha256((root / "india_locations.json").read_bytes()).hexdigest()
        )
        self.assertEqual(meta["states"], len(STATES))
        self.assertEqual(meta["districts"], len(DISTRICTS))
        self.assertEqual(len(meta["receipts"]), len(STATES))
        self.assertEqual(sum(receipt["rows"] for receipt in meta["receipts"]), len(DISTRICTS))
        source = root.parents[1] / "data/reference/india" / meta["source_snapshot_file"]
        self.assertEqual(meta["source_snapshot_sha256"], hashlib.sha256(source.read_bytes()).hexdigest())
        captured = json.loads(source.read_text(encoding="utf-8"))
        self.assertEqual({row["stateCode"] for row in captured["states"]}, set(STATES))
        self.assertEqual({row["districtCode"] for row in captured["districts"]}, set(DISTRICTS))


if __name__ == "__main__":
    unittest.main()
