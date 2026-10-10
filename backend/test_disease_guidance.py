"""Every disease label has plain farmer guidance that never prescribes a dose."""

import json
import re
import unittest
from pathlib import Path

from v2.images import GUIDANCE, farmer_guidance

LABELS = json.loads((Path(__file__).parent / "models/active/class_indices.json").read_text(encoding="utf-8"))
LABELS = LABELS if isinstance(LABELS, list) else [str(x) for x in LABELS.values()]


class GuidanceTests(unittest.TestCase):
    def test_every_disease_label_has_guidance(self):
        diseases = [x for x in LABELS if not x.endswith("healthy")]
        self.assertEqual(set(diseases), set(GUIDANCE["classes"]))

    def test_guidance_has_no_doses_or_products(self):
        text = json.dumps(GUIDANCE)
        self.assertIsNone(re.search(r"\d+\s*(ml|g|kg|l|litre|liter)\s*(/|per)", text, re.IGNORECASE))
        self.assertNotRegex(text.lower(), r"mancozeb|carbendazim|imidacloprid|copper oxychloride|chlorpyrifos")

    def test_detected_healthy_and_uncertain_shapes(self):
        late = farmer_guidance("Potato___Late_blight", "detected")
        self.assertTrue(late["urgent"])
        self.assertIn("Kisan Call Centre", " ".join(late["steps"]))
        self.assertIsNone(farmer_guidance(None, "healthy")["name"])
        self.assertIn("another photo", farmer_guidance(None, "uncertain")["steps"][0])


if __name__ == "__main__":
    unittest.main()
