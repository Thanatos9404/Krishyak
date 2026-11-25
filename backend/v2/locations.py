"""Canonical India location identities from the dated official LGD snapshot."""

import json
import unicodedata
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("india_locations.json").read_text(encoding="utf-8"))
STATES = {row["code"]: row for row in CATALOG["states"]}
DISTRICTS = {row["code"]: row for row in CATALOG["districts"]}


def normalized_name(value):
    return " ".join(unicodedata.normalize("NFKC", value or "").casefold().split())


def name_index(rows, *, district=False):
    index = {}
    for row in rows:
        for name in {row["name"], row["local_name"]} - {""}:
            key = (row["state_code"], normalized_name(name)) if district else normalized_name(name)
            index.setdefault(key, set()).add(row["code"])
    return index


STATE_NAMES = name_index(CATALOG["states"])
# Explicit spelling/script aliases from the India-first input requirements.
STATE_NAMES["rajsthan"] = {8}
STATE_NAMES["राजस्थान"] = {8}
DISTRICT_NAMES = name_index(CATALOG["districts"], district=True)

# Older and English district names that farmers, the speech model and map
# services still use, mapped to the catalogue's current names. Keyed by state,
# because some old names (Aurangabad, Bijapur) are also current districts in
# another state. Every target is checked against the catalogue in tests.
DISTRICT_RENAMES = {
    "Andhra Pradesh": {
        "Anantapur": "Ananthapuramu",
        "Cuddapah": "Y.S.R. Kadapa",
        "Kadapa": "Y.S.R. Kadapa",
        "Nellore": "Sri Potti Sriramulu Nellore",
        "Vizag": "Visakhapatnam",
    },
    "Assam": {
        "Guwahati": "Kamrup Metro",
        "Kamrup Metropolitan": "Kamrup Metro",
        "Karimganj": "Sribhumi",
        "Morigaon": "Marigaon",
        "Sibsagar": "Sivasagar",
    },
    "Bihar": {
        "East Champaran": "Purbi Champaran",
        "Kaimur": "Kaimur (Bhabua)",
        "West Champaran": "Pashchim Champaran",
    },
    "Chhattisgarh": {"Dantewada": "Dakshin Bastar Dantewada"},
    "Gujarat": {
        "Aravalli": "Arvalli",
        "Banaskantha": "Banas Kantha",
        "Baroda": "Vadodara",
        "Chhota Udaipur": "Chhotaudepur",
        "Dang": "Dangs",
        "Kutch": "Kachchh",
        "Mehsana": "Mahesana",
        "Panchmahal": "Panch Mahals",
        "Sabarkantha": "Sabar Kantha",
    },
    "Haryana": {"Gurgaon": "Gurugram", "Mewat": "Nuh"},
    "Jharkhand": {"East Singhbhum": "East Singhbum"},
    "Karnataka": {
        "Bagalkot": "Bagalkote",
        "Bangalore": "Bengaluru Urban",
        "Bangalore Rural": "Bengaluru Rural",
        "Bangalore Urban": "Bengaluru Urban",
        "Bellary": "Ballari",
        "Belgaum": "Belagavi",
        "Bengaluru": "Bengaluru Urban",
        "Bijapur": "Vijayapura",
        "Chikballapur": "Chikkaballapura",
        "Chikmagalur": "Chikkamagaluru",
        "Coorg": "Kodagu",
        "Davangere": "Davanagere",
        "Gulbarga": "Kalaburagi",
        "Hubli": "Dharwad",
        "Mangalore": "Dakshina Kannada",
        "Mysore": "Mysuru",
        "Shimoga": "Shivamogga",
        "Tumkur": "Tumakuru",
    },
    "Kerala": {
        "Alleppey": "Alappuzha",
        "Calicut": "Kozhikode",
        "Cannanore": "Kannur",
        "Cochin": "Ernakulam",
        "Kochi": "Ernakulam",
        "Palghat": "Palakkad",
        "Quilon": "Kollam",
        "Trichur": "Thrissur",
        "Trivandrum": "Thiruvananthapuram",
    },
    "Madhya Pradesh": {
        "East Nimar": "Khandwa (East Nimar)",
        "Hoshangabad": "Narmadapuram",
        "Khandwa": "Khandwa (East Nimar)",
        "Khargone": "Khargone (West Nimar)",
        "West Nimar": "Khargone (West Nimar)",
    },
    "Maharashtra": {
        "Ahmednagar": "Ahilyanagar",
        "Aurangabad": "Chhatrapati Sambhajinagar",
        "Bombay": "Mumbai",
        "Osmanabad": "Dharashiv",
        "Poona": "Pune",
    },
    "Odisha": {
        "Angul": "Anugola",
        "Balasore": "Baleshwar",
        "Bargarh": "Baragada",
        "Berhampur": "Ganjam",
        "Bhubaneswar": "Khordha",
        "Bolangir": "Balangir",
        "Cuttack": "Kataka",
        "Deogarh": "Debagada",
        "Jagatsinghpur": "Jagatsinghapur",
        "Kandhamal": "Kandhamala",
        "Kendrapara": "Kendrapada",
        "Keonjhar": "Kendujhar",
        "Khurda": "Khordha",
        "Nayagarh": "Nayagada",
        "Nowrangpur": "Nabarangpur",
        "Rourkela": "Sundaragada",
        "Sonepur": "Subarnapur",
        "Sundargarh": "Sundaragada",
    },
    "Puducherry": {"Pondicherry": "Puducherry"},
    "Punjab": {
        "Firozpur": "Ferozepur",
        "Mohali": "S.A.S Nagar",
        "Muktsar": "Sri Muktsar Sahib",
        "Nawanshahr": "Shahid Bhagat Singh Nagar",
        "Ropar": "Rupnagar",
    },
    "Rajasthan": {"Chittaurgarh": "Chittorgarh", "Dhaulpur": "Dholpur", "Sri Ganganagar": "Ganganagar"},
    "Tamil Nadu": {
        "Kanchipuram": "Kancheepuram",
        "Kanyakumari": "Kanniyakumari",
        "Madras": "Chennai",
        "Nilgiris": "The Nilgiris",
        "Ooty": "The Nilgiris",
        "Tanjore": "Thanjavur",
        "Trichy": "Tiruchirappalli",
        "Tuticorin": "Thoothukkudi",
        "Villupuram": "Viluppuram",
    },
    "Telangana": {"Rangareddy": "Ranga Reddy"},
    "Uttar Pradesh": {
        "Allahabad": "Prayagraj",
        "Banaras": "Varanasi",
        "Benares": "Varanasi",
        "Faizabad": "Ayodhya",
        "Kanpur": "Kanpur Nagar",
        "Noida": "Gautam Buddha Nagar",
        "Sant Ravidas Nagar": "Bhadohi",
    },
    "West Bengal": {
        "Bardhaman": "Purba Bardhaman",
        "Burdwan": "Purba Bardhaman",
        "Calcutta": "Kolkata",
        "East Midnapore": "Purba Medinipur",
        "Hugli": "Hooghly",
        "Koch Bihar": "Cooch Behar",
        "Maldah": "Malda",
        "Midnapore": "Paschim Medinipur",
        "West Midnapore": "Paschim Medinipur",
    },
}


def renamed_district(state, district):
    """(state, current district) for an older or English name; None when unknown or ambiguous."""
    key = normalized_name(district)
    if not key:
        return None
    if not state and any(name == key for _, name in DISTRICT_NAMES):
        # Without a state, an old name that is also a current district elsewhere
        # (Aurangabad is one in Bihar) is ambiguous.
        return None
    states = [state] if state else list(DISTRICT_RENAMES)
    hits = {
        (name, current)
        for name in states
        for old, current in DISTRICT_RENAMES.get(name, {}).items()
        if normalized_name(old) == key
    }
    return hits.pop() if len(hits) == 1 else None


def resolve_location(state_code=None, district_code=None, state=None, district=None):
    state_key, district_key = normalized_name(state), normalized_name(district)
    if state_code is None and state_key:
        candidates = STATE_NAMES.get(state_key, set())
        if len(candidates) != 1:
            raise ValueError("Select a recognized Indian state or union territory")
        state_code = next(iter(candidates))
    if state_code is not None:
        if state_code not in STATES or (state_key and state_code not in STATE_NAMES.get(state_key, set())):
            raise ValueError("State code and name do not match the location catalogue")
    if district_key or district_code is not None:
        if state_code is None:
            raise ValueError("Select a state before its district")
        candidates = DISTRICT_NAMES.get((state_code, district_key), set())
        if district_code is None:
            if len(candidates) != 1:
                raise ValueError("Select a recognized district within the selected state")
            district_code = next(iter(candidates))
        row = DISTRICTS.get(district_code)
        if row is None or row["state_code"] != state_code or (district_key and district_code not in candidates):
            raise ValueError("District code and name do not match the selected state")
    return {
        "state_code": state_code,
        "district_code": district_code,
        "state": STATES[state_code]["name"] if state_code is not None else None,
        "district": DISTRICTS[district_code]["name"] if district_code is not None else None,
    }
