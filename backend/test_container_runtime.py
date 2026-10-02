"""Linux deployment smoke: synthetic pixels verify execution, never accuracy."""

import io
import unittest

from PIL import Image


class CompactRuntimeSmoke(unittest.TestCase):
    def test_compact_release_can_execute(self):
        import platform

        if platform.system() != "Linux":
            self.skipTest("Compact Linux runtime smoke is run inside Docker/CI")
        from model_inference import is_model_available, predict_from_image

        stream = io.BytesIO()
        Image.new("RGB", (224, 224), (70, 120, 40)).save(stream, "JPEG")
        self.assertTrue(is_model_available())
        result = predict_from_image(stream.getvalue(), crop_type="Tomato")
        self.assertIn(result["status"], ["healthy", "disease_detected", "uncertain"])
        score = result.get("confidence", (result.get("disease") or {}).get("confidence"))
        self.assertIsNotNone(score)
        self.assertTrue(0 <= score <= 1)


if __name__ == "__main__":
    unittest.main()
