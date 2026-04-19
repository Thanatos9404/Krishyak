"""
Mandi Price Adapter Integration
Fetches daily commodity prices from public Mandi portals (e.g., e-NAM / Agmarknet proxy)
Gracefully degrades to cached historical averages or fixed fallback rates.
"""
import logging
import httpx
from typing import Dict, Any, Optional
import os
from datetime import datetime
from data_loader import DataLoader

logger = logging.getLogger(__name__)

class MandiPriceAdapter:
    def __init__(self):
        self.public_api_url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
        self.data_loader = DataLoader()
        self.timeout = 5.0
        self.api_key = os.environ.get("DATA_GOV_IN_API_KEY")
        self.enable_live_fetch = os.environ.get("ENABLE_LIVE_MANDI_FETCH", "false").lower() == "true"
        
    def get_current_mandi_price(self, commodity: str, state: str = None, district: str = None) -> Dict[str, Any]:
        """
        Attempt to fetch live Mandi price if API configured, falling back to local dataset.
        Returns price details strictly following transparency metadata contract.
        """
        if self.enable_live_fetch and self.api_key:
            try:
                with httpx.Client(timeout=self.timeout) as client:
                    response = client.get(self.public_api_url, params={"api-key": self.api_key, "filters[commodity]": commodity})
                    response.raise_for_status()
                    data = response.json()
                    
                    if data.get("records") and len(data["records"]) > 0:
                        # Success path
                        latest = data["records"][0]
                        return {
                            "price": float(latest.get("modal_price", 2000.0)),
                            "source_type": "live_api",
                            "source_label": "Agmarknet (data.gov.in)",
                            "freshness_status": "live",
                            "record_date": latest.get("arrival_date"),
                            "transparency_note": "Live price fetched directly from public Mandi API."
                        }
            except Exception as e:
                logger.warning(f"Mandi API fetch failed ({e}), falling back to historical dataset.")
        
        # Unconfigured or Failed - Graceful degradation
        return self._get_cached_price(commodity)

    def _get_cached_price(self, commodity: str) -> Dict[str, Any]:
        """Fallback to local CSV dataset"""
        stats = self.data_loader.get_price_statistics(commodity)
        
        # Determine if we actually found data in the CSV or if it's a completely static fallback
        if stats["mean"] != 2000 or stats.get("max") != 5000:
            return {
                "price": stats["mean"],
                "source_type": "historical_dataset",
                "source_label": "Historical Dataset",
                "freshness_status": "stale",
                "record_date": None,
                "transparency_note": "Unconfigured live fetch; resolving to historical price statistics."
            }
        
        # Absolute last resort fallback
        return {
            "price": 2000.0,
            "source_type": "static_fallback",
            "source_label": "Static Default",
            "freshness_status": "static",
            "record_date": None,
            "transparency_note": "No price data found. Using absolute default heuristic."
        }

mandi_adapter = MandiPriceAdapter()
