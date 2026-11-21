"""District crop-yield forecasts and local crop mix, served from a trained model's table.

``scripts/train_yield_model.py`` fits a gradient-boosted model on district
records from the Directorate of Economics and Statistics and writes its
forecasts here, so the API needs no machine-learning runtime. The model card
beside the table carries the measured error against the baselines.
"""

import difflib
import gzip
import json
from functools import lru_cache
from pathlib import Path

from .locations import normalized_name

DATA = Path(__file__).parent / "data"
# Where a crop sits in DES season labels when the planning season has no series.
SEASON_FALLBACKS = {
    "rabi": ("rabi", "winter", "annual", "summer"),
    "kharif": ("kharif", "annual", "autumn", "summer"),
    "annual": ("annual", "kharif", "rabi"),
    "summer": ("summer", "annual", "kharif", "rabi"),
}


@lru_cache(maxsize=1)
def table():
    path = DATA / "district_yields.json.gz"
    if not path.exists():
        return None
    with gzip.open(path, "rt", encoding="utf-8") as handle:
        data = json.load(handle)
    by_state = {}
    for key in data["districts"]:
        state, district, _crop, _season = key.split("|")
        by_state.setdefault(state, set()).add(district)
    for key in data.get("common_crops", {}):
        state, district = key.split("|")
        by_state.setdefault(state, set()).add(district)
    data["district_names"] = {state: sorted(names) for state, names in by_state.items()}
    return data


@lru_cache(maxsize=1)
def model_card():
    path = DATA / "yield_model_card.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def match_district(data, state, district):
    """The table's spelling of a district, tolerating renamed and re-spelt districts."""
    state_key, district_key = normalized_name(state or ""), normalized_name(district or "")
    names = data["district_names"].get(state_key, [])
    if district_key in names:
        return state_key, district_key
    close = difflib.get_close_matches(district_key, names, n=1, cutoff=0.82) if district_key else []
    return state_key, close[0] if close else None


def district_yield(crop_id, season, state, district):
    """Forecast yield (kg/ha) for a crop where the farmer is, with the best level available.

    Returns ``None`` when the table has nothing for the crop at any level.
    """
    data = table()
    if data is None or not crop_id:
        return None
    base = {"unit": "kg/ha", "model_id": data["model_id"], "forecast_crop_year": data["forecast_crop_year"]}
    seasons = SEASON_FALLBACKS.get(season, (season,))
    state_key, district_key = match_district(data, state, district)
    if district_key:
        for name in seasons:
            row = data["districts"].get(f"{state_key}|{district_key}|{crop_id}|{name}")
            if row:
                forecast, low, high, years, last_year, last = row
                return {
                    **base,
                    "level": "district",
                    "kg_per_hectare": forecast,
                    "low": low,
                    "high": high,
                    "years_of_records": years,
                    "last_record_year": f"{last_year}-{str(last_year + 1)[2:]}",
                    "last_record_kg_per_hectare": last,
                    "season": name,
                }
    for level, prefix in (("state", f"{state_key}|"), ("national", "")):
        for name in seasons:
            row = data["states" if level == "state" else "nation"].get(f"{prefix}{crop_id}|{name}")
            if row:
                return {
                    **base,
                    "level": level,
                    "kg_per_hectare": row[0],
                    "low": None,
                    "high": None,
                    "years_of_records": None,
                    "last_record_year": f"{row[1]}-{str(row[1] + 1)[2:]}",
                    "last_record_kg_per_hectare": None,
                    "season": name,
                }
    return None


def common_crops(state, district, season=None):
    """Crops farmers in this district grow, by season, with their share of the recorded area."""
    data = table()
    if data is None:
        return {}
    state_key, district_key = match_district(data, state, district)
    seasons = data.get("common_crops", {}).get(f"{state_key}|{district_key}", {}) if district_key else {}
    result = {
        name: [{"crop_id": crop, "area_share_percent": share} for crop, share in rows] for name, rows in seasons.items()
    }
    return {season: result.get(season, [])} if season else result
