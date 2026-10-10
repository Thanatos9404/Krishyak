"""Canonical identity, legacy compatibility, and truthful provider coverage."""

import json
import unittest
from pathlib import Path

from pydantic import ValidationError

import config
from v2.crops import BY_ID, BY_NAME, CATALOG
from v2.schemas import CycleInput


class CropCatalogTests(unittest.TestCase):
    def cycle(self, **crop):
        return CycleInput(sowing_date="2026-09-01", expected_harvest="2026-12-01", **crop)

    def test_every_existing_planning_name_keeps_its_provider_contract(self):
        for name in config.CROPS:
            with self.subTest(crop=name):
                result = self.cycle(crop=name)
                self.assertEqual(result.crop, name)
                self.assertEqual(result.crop_id, BY_NAME[name]["id"])

    def test_id_only_and_matching_legacy_names_resolve_without_localized_identity(self):
        self.assertEqual(self.cycle(crop_id="tomato").crop, "Tomato")
        for name in ["Gram", "Chickpea"]:
            self.assertEqual(self.cycle(crop=name).crop_id, "chickpea")
        for name in ["Tur", "Arhar"]:
            self.assertEqual(self.cycle(crop=name).crop_id, "pigeon_pea")
        for body in [{}, {"crop_id": "unknown"}, {"crop": "टमाटर"}, {"crop_id": "wheat", "crop": "Tomato"}]:
            with self.subTest(body=body), self.assertRaises(ValidationError):
                self.cycle(**body)

    def test_record_support_does_not_imply_planning_or_classifier_support(self):
        self.assertEqual(self.cycle(crop_id="blueberry").crop, "Blueberry")
        self.assertEqual(BY_ID["blueberry"]["planning_names"], [])
        self.assertNotEqual(BY_ID["chilli"]["photo_name"], "pepper")
        self.assertEqual(BY_ID["capsicum"]["photo_name"], "pepper")
        self.assertEqual(BY_ID["grapes"]["photo_name"], "grape")

    def test_frontend_and_backend_use_identical_catalogs(self):
        file = Path(__file__).resolve().parents[1] / "frontend/src/features/product/cropCatalog.json"
        self.assertEqual(json.loads(file.read_text(encoding="utf-8")), CATALOG)
        self.assertEqual(len(BY_ID), len(CATALOG))


if __name__ == "__main__":
    unittest.main()
