"""Trusted spectral definitions; never a disease/crop/soil diagnosis."""
import math

INDICES = {
    "true_color": {"bands": ["B04", "B03", "B02"], "formula": "RGB = 2.5 × [B04, B03, B02] (display stretch)", "resolution": 10},
    "ndvi": {"bands": ["B08", "B04"], "formula": "(B08 - B04) / (B08 + B04)", "resolution": 10},
    "ndmi": {"bands": ["B08", "B11"], "formula": "(B08 - B11) / (B08 + B11)", "resolution": 20},
    "ndre": {"bands": ["B8A", "B05"], "formula": "(B8A - B05) / (B8A + B05)", "resolution": 20},
}
MIN_VALID_FRACTION = .6
MIN_VALID_SAMPLES = 10
MIN_TREND_HISTORY = 4
TREND_FLOOR = .03
LIMITATIONS = [
    "Spectral observations cannot identify a disease, pest, crop species or exact soil N/P/K.",
    "10 m visible/NIR and 20 m red-edge/SWIR/SCL pixels mix plants and field edges.",
    "Cloud masking is imperfect; water is excluded, including flooded crop pixels.",
    "Changes may reflect crop stage, harvest, irrigation, soil or atmosphere. Verify on the ground.",
    "Interval results are most-recent pixel mosaics, not interval means of every acquisition.",
    "Field valid fraction conservatively includes nominal geodesic pixel coverage; grid-edge counts are approximate.",
    "Trend is an unvalidated field-relative inspection cue, not a yield or financial model.",
]


def normalized_difference(a, b):
    if not all(math.isfinite(v) and v >= 0 for v in (a, b)) or abs(a + b) <= 1e-6:
        return None
    return (a - b) / (a + b)
