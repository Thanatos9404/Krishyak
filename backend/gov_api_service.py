"""
Government API Service for Krishyak
Integrates with:
- LG Directory API for location data
- data.gov.in for MSP prices
- data.gov.in for live mandi prices
"""

import httpx
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from functools import lru_cache
import asyncio

logger = logging.getLogger(__name__)

# API Configuration
DATA_GOV_API_KEY = "579b464db66ec23bdd000001c0b342ce86264f806fba2e185300b9bc"
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
            return _cache[key]
    return None


def _set_cache(key: str, value: Any):
    """Set cache value with current timestamp"""
    _cache[key] = value
    _cache_times[key] = datetime.now()


# ============================================================================
# MSP (Minimum Support Price) Service
# ============================================================================

# Updated MSP data for 2025-26 (from official sources)
MSP_DATA_2025_26 = {
    "season": "Kharif 2025-26 & Rabi 2025-26",
    "lastUpdated": "2025-07-01",
    "source": "Ministry of Agriculture & Farmers Welfare, Government of India",
    "crops": {
        # Kharif Crops 2025-26
        "Rice": {"msp": 2320, "unit": "quintal", "season": "Kharif", "common_variety": "Common Grade"},
        "Rice (Grade A)": {"msp": 2370, "unit": "quintal", "season": "Kharif", "common_variety": "Grade A"},
        "Jowar": {"msp": 3371, "unit": "quintal", "season": "Kharif", "common_variety": "Hybrid"},
        "Bajra": {"msp": 2625, "unit": "quintal", "season": "Kharif", "common_variety": "Pearl Millet"},
        "Ragi": {"msp": 4290, "unit": "quintal", "season": "Kharif", "common_variety": "Finger Millet"},
        "Maize": {"msp": 2225, "unit": "quintal", "season": "Kharif", "common_variety": "Common"},
        "Tur": {"msp": 7550, "unit": "quintal", "season": "Kharif", "common_variety": "Arhar/Red Gram"},
        "Moong": {"msp": 8682, "unit": "quintal", "season": "Kharif", "common_variety": "Green Gram"},
        "Urad": {"msp": 7400, "unit": "quintal", "season": "Kharif", "common_variety": "Black Gram"},
        "Cotton": {"msp": 7521, "unit": "quintal", "season": "Kharif", "common_variety": "Medium Staple"},
        "Cotton (Long Staple)": {"msp": 7971, "unit": "quintal", "season": "Kharif", "common_variety": "Long Staple"},
        "Groundnut": {"msp": 6783, "unit": "quintal", "season": "Kharif", "common_variety": "In Shell"},
        "Sunflower": {"msp": 7280, "unit": "quintal", "season": "Kharif", "common_variety": "Seed"},
        "Soybean": {"msp": 4892, "unit": "quintal", "season": "Kharif", "common_variety": "Yellow"},
        "Sesame": {"msp": 9267, "unit": "quintal", "season": "Kharif", "common_variety": "Sesamum"},
        "Niger Seed": {"msp": 8717, "unit": "quintal", "season": "Kharif", "common_variety": "Niger"},
        
        # Rabi Crops 2025-26
        "Wheat": {"msp": 2425, "unit": "quintal", "season": "Rabi", "common_variety": "Common"},
        "Barley": {"msp": 1980, "unit": "quintal", "season": "Rabi", "common_variety": "Common"},
        "Gram": {"msp": 5650, "unit": "quintal", "season": "Rabi", "common_variety": "Chana"},
        "Lentil": {"msp": 6700, "unit": "quintal", "season": "Rabi", "common_variety": "Masoor"},
        "Mustard": {"msp": 5950, "unit": "quintal", "season": "Rabi", "common_variety": "Rapeseed"},
        "Safflower": {"msp": 5940, "unit": "quintal", "season": "Rabi", "common_variety": "Carthamus"},
        
        # Other/Annual Crops
        "Sugarcane": {"msp": 340, "unit": "quintal", "season": "Annual", "common_variety": "FRP"},
        "Jute": {"msp": 5335, "unit": "quintal", "season": "Kharif", "common_variety": "Raw"},
        "Copra": {"msp": 11582, "unit": "quintal", "season": "Annual", "common_variety": "Milling"},
        "Copra (Ball)": {"msp": 12100, "unit": "quintal", "season": "Annual", "common_variety": "Ball"},
        "De-husked Coconut": {"msp": 3200, "unit": "per 1000 nuts", "season": "Annual", "common_variety": "Dehusked"},
    }
}


async def fetch_msp_from_api(crop: Optional[str] = None) -> Dict:
    """
    Fetch MSP prices from data.gov.in API
    Falls back to static data if API fails
    """
    cache_key = f"msp_{crop or 'all'}"
    cached = _get_cache(cache_key, "msp")
    if cached:
        return cached
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            params = {
                "api-key": DATA_GOV_API_KEY,
                "format": "json",
                "limit": 100
            }
            
            response = await client.get(MSP_API_URL, params=params)
            
            if response.status_code == 200:
                data = response.json()
                if data.get("records"):
                    # Process API response
                    result = {
                        "source": "data.gov.in API",
                        "fetched_at": datetime.now().isoformat(),
                        "crops": {}
                    }
                    
                    for record in data["records"]:
                        crop_name = record.get("commodity", "")
                        if crop_name:
                            result["crops"][crop_name] = {
                                "msp": float(record.get("msp_price", 0)),
                                "unit": "quintal",
                                "season": record.get("season", "Unknown"),
                                "year": record.get("year", "2025-26")
                            }
                    
                    if result["crops"]:
                        _set_cache(cache_key, result)
                        logger.info(f"Fetched MSP data from API: {len(result['crops'])} crops")
                        return result
    
    except Exception as e:
        logger.warning(f"Failed to fetch MSP from API: {e}")
    
    # Fallback to static data
    logger.info("Using static MSP data (2025-26)")
    return MSP_DATA_2025_26


def get_msp_for_crop(crop: str) -> Optional[Dict]:
    """Get MSP for a specific crop from static data"""
    # Normalize crop name
    crop_normalized = crop.strip().title()
    
    # Direct match
    if crop_normalized in MSP_DATA_2025_26["crops"]:
        return {
            "crop": crop_normalized,
            **MSP_DATA_2025_26["crops"][crop_normalized]
        }
    
    # Try partial match
    for crop_name, data in MSP_DATA_2025_26["crops"].items():
        if crop_normalized.lower() in crop_name.lower():
            return {"crop": crop_name, **data}
    
    return None


def get_all_msp() -> Dict:
    """Get all MSP prices"""
    return MSP_DATA_2025_26


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
    cache_key = f"mandi_{commodity}_{state}_{district}"
    cached = _get_cache(cache_key, "mandi")
    if cached:
        return cached
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            params = {
                "api-key": DATA_GOV_API_KEY,
                "format": "json",
                "limit": limit
            }
            
            # Add filters
            filters = []
            if commodity:
                filters.append(f"commodity={commodity}")
            if state:
                filters.append(f"state={state}")
            if district:
                filters.append(f"district={district}")
            
            if filters:
                params["filters[" + "][".join(filters) + "]"] = ""
            
            response = await client.get(MANDI_PRICES_API_URL, params=params)
            
            if response.status_code == 200:
                data = response.json()
                
                result = {
                    "source": "data.gov.in API",
                    "fetched_at": datetime.now().isoformat(),
                    "total": data.get("total", 0),
                    "prices": []
                }
                
                for record in data.get("records", []):
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
                
                if result["prices"]:
                    _set_cache(cache_key, result)
                    logger.info(f"Fetched {len(result['prices'])} mandi prices")
                    return result
                    
    except Exception as e:
        logger.warning(f"Failed to fetch mandi prices: {e}")
    
    # Return empty result on failure
    return {
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
    {"code": "DN", "name": "Dadra and Nagar Haveli", "nameHi": "दादरा और नगर हवेली"},
    {"code": "DD", "name": "Daman and Diu", "nameHi": "दमन और दीव"},
    {"code": "DL", "name": "Delhi", "nameHi": "दिल्ली"},
    {"code": "LD", "name": "Lakshadweep", "nameHi": "लक्षद्वीप"},
    {"code": "PY", "name": "Puducherry", "nameHi": "पुडुचेरी"},
    {"code": "LA", "name": "Ladakh", "nameHi": "लद्दाख"},
]


def get_all_states() -> List[Dict]:
    """Get all Indian states"""
    return INDIAN_STATES


async def fetch_districts(state: str) -> List[Dict]:
    """
    Fetch districts for a state
    Currently uses static data; can be extended to use LG Directory API
    """
    # Import static data as fallback
    # In future, this can call LG Directory API
    from data_loader import load_districts_for_state
    
    try:
        districts = load_districts_for_state(state)
        return districts
    except Exception as e:
        logger.warning(f"Failed to load districts for {state}: {e}")
        return []


async def fetch_tehsils(state: str, district: str) -> List[str]:
    """
    Fetch tehsils for a district
    Currently uses static data; can be extended to use LG Directory API
    """
    from data_loader import load_tehsils_for_district
    
    try:
        tehsils = load_tehsils_for_district(state, district)
        return tehsils
    except Exception as e:
        logger.warning(f"Failed to load tehsils for {state}/{district}: {e}")
        return []


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
