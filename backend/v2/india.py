"""Canonical India contact and unit normalization; never log entered values."""

import re
from decimal import Decimal

ACRE_HECTARES = Decimal("0.40468564224")


def normalize_mobile(value):
    if not isinstance(value, str) or len(value) > 40 or not re.fullmatch(r"[+0-9 ()-]+", value):
        raise ValueError("Enter a valid Indian mobile number")
    compact = re.sub(r"[ ()-]", "", value)
    if re.fullmatch(r"[6-9][0-9]{9}", compact):
        compact = "+91" + compact
    if not re.fullmatch(r"\+91[6-9][0-9]{9}", compact):
        raise ValueError("Enter a valid Indian mobile number")
    return compact


def area_hectares(value, unit):
    if unit not in {"acre", "hectare"}:
        raise ValueError("Unsupported area unit")
    area = Decimal(str(value))
    if not area.is_finite() or area <= 0:
        raise ValueError("Enter a positive field area")
    result = area * ACRE_HECTARES if unit == "acre" else area
    if result > 500:
        raise ValueError("Field area exceeds 500 hectares")
    return result
