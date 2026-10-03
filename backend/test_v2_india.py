import unittest
from decimal import Decimal

from pydantic import ValidationError

from v2.india import area_hectares
from v2.schemas import RequestOTP


class IndiaNormalizationTests(unittest.TestCase):
    def test_formatted_numbers_share_one_canonical_identity(self):
        for value in ["9000000001", "90000 00001", "+91 90000 00001", "+919000000001", "+91 (90000) 00001"]:
            with self.subTest(value=value):
                self.assertEqual(RequestOTP(mobile=value).mobile, "+919000000001")

    def test_invalid_and_foreign_numbers_are_rejected(self):
        for value in [
            "+19000000001",
            "5000000001",
            "09000000001",
            "919000000001",
            "900000000",
            "90000000012",
            "++919000000001",
            "nine000000001",
            9000000001,
        ]:
            with self.subTest(value=value):
                with self.assertRaises(ValidationError):
                    RequestOTP(mobile=value)

    def test_area_conversion_is_decimal_and_jurisdiction_independent(self):
        self.assertEqual(area_hectares("1", "acre"), Decimal("0.40468564224"))
        self.assertEqual(area_hectares("2.5", "acre"), Decimal("1.011714105600"))
        self.assertEqual(area_hectares("1.5", "hectare"), Decimal("1.5"))
        for value, unit in [
            ("NaN", "acre"),
            ("Infinity", "acre"),
            ("-1", "acre"),
            ("0", "hectare"),
            ("501", "hectare"),
            ("1", "bigha"),
        ]:
            with self.subTest(value=value, unit=unit):
                with self.assertRaises(ValueError):
                    area_hectares(value, unit)
