"""
Government API Service for Krishyak
Integrates with:
- Local location suggestions (not an LG Directory integration)
- Source-linked official MSP publications
- data.gov.in for live mandi prices
"""

import httpx
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from functools import lru_cache
import asyncio
import os
import math
from pathlib import Path
from copy import deepcopy

logger = logging.getLogger(__name__)

# API Configuration
DATA_GOV_API_KEY = os.environ.get("DATA_GOV_IN_API_KEY", "")
MSP_API_URL = "https://api.data.gov.in/resource/1832c7b4-82ef-4734-b2b4-c2e3a38a28d3"
MANDI_PRICES_API_URL = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

# Cache storage
_cache: Dict[str, Any] = {}
_cache_times: Dict[str, datetime] = {}

CACHE_DURATIONS = {
    "locations": timedelta(days=7),  # Location data rarely changes
    "msp": timedelta(hours=24),      # MSP updates infrequently
    "mandi": timedelta(minutes=30),  # Mandi prices update frequently
}


def _get_cache(key: str, cache_type: str = "msp") -> Optional[Any]:
    """Get cached value if not expired"""
    if key in _cache and key in _cache_times:
        expiry = _cache_times[key] + CACHE_DURATIONS.get(cache_type, timedelta(hours=1))
        if datetime.now() < expiry:
            return deepcopy(_cache[key])
    return None


def _set_cache(key: str, value: Any):
    """Set cache value with current timestamp"""
    _cache[key] = deepcopy(value)
    _cache_times[key] = datetime.now()


# ============================================================================
# MSP (Minimum Support Price) Service
# ============================================================================

# Versioned, source-linked official publications; both API and offline UI use this dataset.
MSP_DATA = json.loads((Path(__file__).resolve().parent / 'data/msp_data.json').read_text(encoding='utf-8'))


def get_msp_for_crop(crop: str) -> Optional[Dict]:
    """Match a complete crop name or a documented alias, never a substring."""
    aliases = {'paddy': 'rice', 'arhar': 'tur', 'chickpea': 'gram', 'chana': 'gram',
               'masur': 'lentil', 'sesamum': 'sesame'}
    key = aliases.get(crop.strip().casefold(), crop.strip().casefold())
    for name, entry in MSP_DATA['crops'].items():
        if name.casefold() == key:
            return {'crop': name, **deepcopy(entry)}
    return None


def get_all_msp() -> Dict:
    """Return the verified publication snapshot with record-specific year and source."""
    return deepcopy(MSP_DATA)


async def fetch_msp_from_api(crop: Optional[str] = None) -> Dict:
    """Compatibility entry: serve verified publications rather than an unverified API schema."""
    if crop is None:
        return get_all_msp()
    record = get_msp_for_crop(crop)
    return {**get_all_msp(), 'crops': {record['crop']: record} if record else {}}


# ============================================================================
# Mandi (Market) Prices Service
# ============================================================================

async def fetch_mandi_prices(
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = 50
) -> Dict:
    """
    Fetch live mandi prices from data.gov.in
    """
    if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    cache_key = f"mandi_{commodity}_{state}_{district}_{limit}"
    cached = _get_cache(cache_key, "mandi")
    if cached:
        return cached
    
    if not DATA_GOV_API_KEY:
        return {"available": False, "source": "data.gov.in API", "prices": [], "total": 0,
                "error": "Live mandi prices are not configured.", "error_code": "not_configured"}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {
                "api-key": DATA_GOV_API_KEY,
                "format": "json",
                "limit": limit
            }
            
            for name, value in [('commodity', commodity), ('state', state), ('district', district)]:
                if value:
                    params[f'filters[{name}]'] = value

            response = await client.get(MANDI_PRICES_API_URL, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, dict) or not isinstance(data.get("records"), list):
                    raise ValueError("Invalid mandi response schema")
                result = {
                    "available": True,
                    "source": "data.gov.in API",
                    "source_type": "official_api",
                    "fetched_at": datetime.now().isoformat(),
                    "total": data.get("total", 0),
                    "prices": []
                }
                
                for record in data["records"]:
                    if not isinstance(record, dict):
                        continue
                    if any(value and str(record.get(name, '')).casefold() != value.casefold()
                           for name, value in [('commodity', commodity), ('state', state), ('district', district)]):
                        continue
                    try:
                        prices = [float(record.get(name)) for name in ('min_price', 'modal_price', 'max_price')]
                    except (TypeError, ValueError):
                        continue
                    if not all(math.isfinite(v) and v > 0 for v in prices) or not prices[0] <= prices[1] <= prices[2]:
                        continue
                    result["prices"].append({
                        "state": record.get("state", ""),
                        "district": record.get("district", ""),
                        "market": record.get("market", ""),
                        "commodity": record.get("commodity", ""),
                        "variety": record.get("variety", ""),
                        "arrival_date": record.get("arrival_date", ""),
                        "min_price": float(record.get("min_price", 0)),
                        "max_price": float(record.get("max_price", 0)),
                        "modal_price": float(record.get("modal_price", 0)),
                    })
                
                if result["prices"] or not data["records"]:
                    _set_cache(cache_key, result)
                    logger.info(f"Fetched {len(result['prices'])} mandi prices")
                    return result
                    
    except Exception as e:
        logger.warning(f"Failed to fetch mandi prices: {e}")
    
    # Return empty result on failure
    return {
        "available": False,
        "source": "API unavailable",
        "fetched_at": datetime.now().isoformat(),
        "total": 0,
        "prices": [],
        "error": "Could not fetch live mandi prices. Please try again later."
    }


# ============================================================================
# Location Data Service
# ============================================================================

# Indian states with codes (for API queries)
INDIAN_STATES = [
    {"code": "AP", "name": "Andhra Pradesh", "nameHi": "आंध्र प्रदेश"},
    {"code": "AR", "name": "Arunachal Pradesh", "nameHi": "अरुणाचल प्रदेश"},
    {"code": "AS", "name": "Assam", "nameHi": "असम"},
    {"code": "BR", "name": "Bihar", "nameHi": "बिहार"},
    {"code": "CG", "name": "Chhattisgarh", "nameHi": "छत्तीसगढ़"},
    {"code": "GA", "name": "Goa", "nameHi": "गोवा"},
    {"code": "GJ", "name": "Gujarat", "nameHi": "गुजरात"},
    {"code": "HR", "name": "Haryana", "nameHi": "हरियाणा"},
    {"code": "HP", "name": "Himachal Pradesh", "nameHi": "हिमाचल प्रदेश"},
    {"code": "JK", "name": "Jammu and Kashmir", "nameHi": "जम्मू और कश्मीर"},
    {"code": "JH", "name": "Jharkhand", "nameHi": "झारखंड"},
    {"code": "KA", "name": "Karnataka", "nameHi": "कर्नाटक"},
    {"code": "KL", "name": "Kerala", "nameHi": "केरल"},
    {"code": "MP", "name": "Madhya Pradesh", "nameHi": "मध्य प्रदेश"},
    {"code": "MH", "name": "Maharashtra", "nameHi": "महाराष्ट्र"},
    {"code": "MN", "name": "Manipur", "nameHi": "मणिपुर"},
    {"code": "ML", "name": "Meghalaya", "nameHi": "मेघालय"},
    {"code": "MZ", "name": "Mizoram", "nameHi": "मिजोरम"},
    {"code": "NL", "name": "Nagaland", "nameHi": "नागालैंड"},
    {"code": "OD", "name": "Odisha", "nameHi": "ओडिशा"},
    {"code": "PB", "name": "Punjab", "nameHi": "पंजाब"},
    {"code": "RJ", "name": "Rajasthan", "nameHi": "राजस्थान"},
    {"code": "SK", "name": "Sikkim", "nameHi": "सिक्किम"},
    {"code": "TN", "name": "Tamil Nadu", "nameHi": "तमिलनाडु"},
    {"code": "TS", "name": "Telangana", "nameHi": "तेलंगाना"},
    {"code": "TR", "name": "Tripura", "nameHi": "त्रिपुरा"},
    {"code": "UK", "name": "Uttarakhand", "nameHi": "उत्तराखंड"},
    {"code": "UP", "name": "Uttar Pradesh", "nameHi": "उत्तर प्रदेश"},
    {"code": "WB", "name": "West Bengal", "nameHi": "पश्चिम बंगाल"},
    {"code": "AN", "name": "Andaman and Nicobar Islands", "nameHi": "अंडमान और निकोबार द्वीप"},
    {"code": "CH", "name": "Chandigarh", "nameHi": "चंडीगढ़"},
    {"code": "DN", "name": "Dadra and Nagar Haveli and Daman and Diu", "nameHi": "Dadra and Nagar Haveli and Daman and Diu"},
    {"code": "DL", "name": "Delhi", "nameHi": "दिल्ली"},
    {"code": "LD", "name": "Lakshadweep", "nameHi": "लक्षद्वीप"},
    {"code": "PY", "name": "Puducherry", "nameHi": "पुडुचेरी"},
    {"code": "LA", "name": "Ladakh", "nameHi": "लद्दाख"},
]


def get_all_states() -> List[Dict]:
    """Get all Indian states"""
    return deepcopy(INDIAN_STATES)


LOCATION_SUGGESTIONS = json.loads(
    (Path(__file__).resolve().parent / 'data/location_suggestions.json').read_text(encoding='utf-8'))


def _location_state(state: str) -> Optional[Dict]:
    key = state.strip().casefold()
    for entry in INDIAN_STATES:
        if entry['code'].casefold() == key:
            key = entry['name'].casefold()
            break
    return next((entry for entry in LOCATION_SUGGESTIONS['states']
                 if entry['name'].casefold() == key), None)


async def fetch_districts(state: str) -> List[Dict]:
    """Return partial registration suggestions, not verified administrative records."""
    entry = _location_state(state)
    return deepcopy(entry['districts']) if entry else []


async def fetch_tehsils(state: str, district: str) -> List[str]:
    """Return partial suggestions for a district; unknown locations remain enterable."""
    entries = await fetch_districts(state)
    match = next((entry for entry in entries
                  if entry['name'].casefold() == district.strip().casefold()), None)
    return deepcopy(match['tehsils']) if match else []


# ============================================================================
# Utility Functions
# ============================================================================

def clear_cache():
    """Clear all cached data"""
    global _cache, _cache_times
    _cache = {}
    _cache_times = {}
    logger.info("Cache cleared")


def get_cache_stats() -> Dict:
    """Get cache statistics"""
    return {
        "entries": len(_cache),
        "oldest": min(_cache_times.values()).isoformat() if _cache_times else None,
        "newest": max(_cache_times.values()).isoformat() if _cache_times else None,
    }
