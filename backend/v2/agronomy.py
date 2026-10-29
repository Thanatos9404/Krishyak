"""General crop plans and soil helpers for spoken farm setup and field assessments.

Values are general Indian package-of-practice figures (ICAR/state university
ranges) used as starting assumptions. A Soil Health Card or local KVK advice
always overrides them; the assessment says so.
"""

import difflib

from .locations import CATALOG, DISTRICTS, STATES, normalized_name, resolve_location

SOIL_TYPES = ("Alluvial", "Black", "Red", "Laterite", "Desert", "Mountain", "Loamy", "Clay", "Sandy")
AREA_UNITS = ("hectare", "acre", "bigha", "guntha", "kanal", "cent")
ACRE = 0.40468564224
FIXED_UNITS = {"hectare": 1.0, "acre": ACRE, "guntha": ACRE / 40, "cent": ACRE / 100, "kanal": ACRE / 8}
SQ_FT = 0.09290304
# Widely used standard bigha sizes only (square metres); elsewhere the farmer confirms.
BIGHA_SQUARE_METRES = {
    "West Bengal": 14400 * SQ_FT,
    "Assam": 14400 * SQ_FT,
    "Tripura": 14400 * SQ_FT,
    "Rajasthan": 27225 * SQ_FT,
}

# id: (season, days to harvest, seed kg/ha, N, P2O5, K2O kg/ha)
CROP_PLANS = {
    "wheat": ("rabi", 135, 100, 120, 60, 40),
    "barley": ("rabi", 125, 100, 60, 30, 20),
    "mustard": ("rabi", 125, 5, 80, 40, 40),
    "chickpea": ("rabi", 115, 75, 20, 40, 20),
    "lentil": ("rabi", 120, 40, 20, 40, 20),
    "cumin": ("rabi", 120, 12, 30, 20, 0),
    "potato": ("rabi", 100, 2500, 150, 80, 100),
    "onion": ("rabi", 130, 8, 100, 50, 50),
    "rice": ("kharif", 125, 30, 100, 50, 50),
    "maize": ("kharif", 100, 20, 120, 60, 40),
    "bajra": ("kharif", 85, 4, 60, 30, 0),
    "jowar": ("kharif", 110, 10, 80, 40, 40),
    "cotton": ("kharif", 170, 3, 100, 50, 50),
    "soybean": ("kharif", 100, 70, 30, 60, 40),
    "groundnut": ("kharif", 115, 100, 20, 40, 40),
    "moong": ("kharif", 70, 20, 20, 40, 20),
    "urad": ("kharif", 80, 20, 20, 40, 20),
    "pigeon_pea": ("kharif", 170, 15, 20, 50, 20),
    "sesame": ("kharif", 90, 5, 40, 20, 20),
    "sugarcane": ("annual", 330, 7500, 250, 100, 100),
}
# Assumed seasonal water (mm) from rain, plus moisture the monsoon leaves in
# the soil for rabi crops, when no forecast covers the whole season.
SEASON_RAIN_MM = {"rabi": 150, "kharif": 600, "annual": 900}

# Coarse dominant soil per state (NBSS&LUP soil map), used only when nothing
# better is known and always labelled as a rough guess.
STATE_SOILS = {
    "Punjab": "Alluvial",
    "Haryana": "Alluvial",
    "Uttar Pradesh": "Alluvial",
    "Bihar": "Alluvial",
    "West Bengal": "Alluvial",
    "Assam": "Alluvial",
    "Delhi": "Alluvial",
    "Rajasthan": "Sandy",
    "Gujarat": "Black",
    "Maharashtra": "Black",
    "Madhya Pradesh": "Black",
    "Karnataka": "Red",
    "Tamil Nadu": "Red",
    "Andhra Pradesh": "Red",
    "Telangana": "Red",
    "Odisha": "Red",
    "Jharkhand": "Red",
    "Chhattisgarh": "Red",
    "Kerala": "Laterite",
    "Goa": "Laterite",
    "Meghalaya": "Laterite",
    "Tripura": "Laterite",
    "Manipur": "Laterite",
    "Mizoram": "Laterite",
    "Nagaland": "Laterite",
    "Arunachal Pradesh": "Mountain",
    "Himachal Pradesh": "Mountain",
    "Uttarakhand": "Mountain",
    "Jammu And Kashmir": "Mountain",
    "Ladakh": "Mountain",
    "Sikkim": "Mountain",
}
BLACK_SOIL_STATES = {"Maharashtra", "Madhya Pradesh", "Gujarat", "Telangana", "Karnataka", "Andhra Pradesh"}
PLAINS_STATES = {"Punjab", "Haryana", "Uttar Pradesh", "Bihar", "West Bengal", "Assam", "Delhi"}


EAST_RAJASTHAN = {
    "Alwar",
    "Bharatpur",
    "Dholpur",
    "Karauli",
    "Dausa",
    "Sawai Madhopur",
    "Jaipur",
    "Tonk",
    "Kota",
    "Bundi",
    "Baran",
    "Jhalawar",
    "Deeg",
    "Khairthal-Tijara",
    "Kotputli-Behror",
}


def typical_soil(state, district=None, longitude=None):
    """Rough regional soil when no measurement exists. Rajasthan's east is alluvial plain."""
    if state == "Rajasthan" and (district in EAST_RAJASTHAN or (longitude or 0) >= 75.8):
        return "Alluvial"
    return STATE_SOILS.get(state or "")


def fertilizer_products(crop_id):
    """kg/ha of DAP, urea and MOP that supply the plan's N, P2O5 and K2O."""
    _, _, _, n, p, k = CROP_PLANS[crop_id]
    dap = p / 0.46
    urea = max(0.0, n - dap * 0.18) / 0.46
    return {"DAP": round(dap, 1), "Urea": round(urea, 1), "MOP": round(k / 0.60, 1)}


def area_to_hectares(value, unit, state=None, bigha_square_metres=None):
    """Hectares, or None when a bigha's local size is unknown."""
    if value is None or unit not in AREA_UNITS or not 0 < float(value) <= 100000:
        return None
    if unit == "bigha":
        size = bigha_square_metres or BIGHA_SQUARE_METRES.get(state or "")
        return None if not size else round(float(value) * size / 10000, 4)
    return round(float(value) * FIXED_UNITS[unit], 4)


def soil_from_texture(soil, state=None):
    """Map SoilGrids topsoil texture (g/kg) to the planning soil classes."""
    if soil is None or soil.sand_g_kg is None or soil.clay_g_kg is None:
        return None
    sand, clay = soil.sand_g_kg / 10, soil.clay_g_kg / 10
    silt = soil.silt_g_kg / 10 if soil.silt_g_kg is not None else max(0.0, 100 - sand - clay)
    if sand >= 70:
        return "Sandy"
    if clay >= 35:
        return "Black" if state in BLACK_SOIL_STATES else "Clay"
    if silt >= 40 and state in PLAINS_STATES:
        return "Alluvial"
    return "Loamy"


def match_location(state=None, district=None):
    """Resolve spoken names (with spelling variants) to the official catalogue."""
    try:
        return resolve_location(state=state or None, district=district or None)
    except ValueError:
        pass
    state_code = None
    if state:
        names = {normalized_name(row["name"]): code for code, row in STATES.items()}
        close = difflib.get_close_matches(normalized_name(state), list(names), n=1, cutoff=0.8)
        state_code = names[close[0]] if close else None
    if district:
        rows = [row for row in CATALOG["districts"] if state_code is None or row["state_code"] == state_code]
        names = {normalized_name(row["name"]): row["code"] for row in rows}
        close = difflib.get_close_matches(normalized_name(district), list(names), n=1, cutoff=0.75)
        if close:
            row = DISTRICTS[names[close[0]]]
            return resolve_location(state_code=row["state_code"], district_code=row["code"])
    return resolve_location(state_code=state_code) if state_code else None
