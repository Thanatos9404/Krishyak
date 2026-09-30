"""Data loading and preprocessing module"""
import pandas as pd
import numpy as np
from pathlib import Path
from typing import Dict, Optional
import config

class DataLoader:
    """Load and preprocess agricultural datasets"""
    
    def __init__(self):
        self.crop_data = None
        self.price_data = None
        self.load_datasets()
    
    def load_datasets(self):
        """Load all available datasets"""
        try:
            # Load crop yield data
            crop_file = config.DATA_DIR / "All-India_-Crop-wise-Area,-Production-&-Yield.csv"
            if crop_file.exists():
                self.crop_data = pd.read_csv(crop_file)
                self._preprocess_crop_data()
            
            # Load market price data
            price_file = config.DATA_DIR / "9ef84268-d588-465a-a308-a864a43d0070.csv"
            if price_file.exists():
                self.price_data = pd.read_csv(price_file)
                self._preprocess_price_data()
                
        except Exception as e:
            print(f"Error loading datasets: {e}")
    
    def _preprocess_crop_data(self):
        """Clean and prepare crop yield data"""
        if self.crop_data is not None:
            # Remove empty strings and convert to numeric
            numeric_cols = [col for col in self.crop_data.columns if 'Yield' in col or 'Production' in col or 'Area' in col]
            for col in numeric_cols:
                self.crop_data[col] = pd.to_numeric(self.crop_data[col], errors='coerce')
    
    def _preprocess_price_data(self):
        """Clean and prepare market price data"""
        if self.price_data is not None:
            # Convert price columns to numeric
            price_cols = ['Min_x0020_Price', 'Max_x0020_Price', 'Modal_x0020_Price']
            for col in price_cols:
                if col in self.price_data.columns:
                    self.price_data[col] = pd.to_numeric(self.price_data[col], errors='coerce')
            
            # Parse date
            if 'Arrival_Date' in self.price_data.columns:
                self.price_data['Arrival_Date'] = pd.to_datetime(self.price_data['Arrival_Date'], errors='coerce', dayfirst=True)
    
    def get_crop_yield(self, crop: str, season: str = "Total") -> float:
        """Get average yield for a crop"""
        return self.get_crop_yield_record(crop, season)['value']

    def get_crop_yield_record(self, crop: str, season: str = "Total") -> Dict:
        fallback = {'value': config.DEFAULT_YIELDS.get(crop, 2000), 'source': 'static_config',
                    'record_year': None, 'units': 'kg/ha', 'region': 'not_localized',
                    'product_basis': 'lint' if crop == 'Cotton' else 'crop_product'}
        if self.crop_data is None:
            return fallback
        if not {'Crop', 'Season'}.issubset(self.crop_data.columns):
            return fallback
        alias = {'Chickpea': 'Gram', 'Arhar': 'Tur', 'Sesame': 'Sesamum'}.get(crop, crop)
        
        crop_rows = self.crop_data[
            (self.crop_data['Crop'].str.strip().str.casefold() == alias.casefold()) &
            (self.crop_data['Season'].str.strip().str.casefold() == season.casefold())
        ]
        
        if len(crop_rows) > 0:
            # Get most recent yield
            yield_cols = sorted([col for col in crop_rows.columns if col.startswith('Yield-')], reverse=True)
            for col in yield_cols:
                recent_yield = crop_rows[col].values[0]
                if pd.notna(recent_yield) and np.isfinite(recent_yield) and recent_yield > 0:
                    return {**fallback, 'value': float(recent_yield), 'source': 'All-India crop yield CSV',
                            'record_year': col.removeprefix('Yield-'), 'region': 'India national aggregate'}
        
        return fallback
    
    def get_commodity_prices(self, commodity: str, days: int = 60) -> pd.DataFrame:
        """Get recent price data for a commodity"""
        if self.price_data is None:
            return pd.DataFrame()
        
        commodity_data = self.price_data[
            self.price_data['Commodity'].str.strip().str.casefold().eq(commodity.strip().casefold())
        ].copy()
        
        if len(commodity_data) > 0:
            # A cross-section of markets on one date is not a daily time series.
            commodity_data = commodity_data.dropna(subset=['Arrival_Date', 'Modal_x0020_Price'])
            commodity_data = commodity_data[np.isfinite(commodity_data['Modal_x0020_Price']) & (commodity_data['Modal_x0020_Price'] > 0)]
            daily = commodity_data.groupby('Arrival_Date', as_index=False)['Modal_x0020_Price'].median()
            return daily.sort_values('Arrival_Date').tail(days)
        
        return pd.DataFrame()
    
    def get_historical_yield_trend(self, crop: str) -> Dict:
        """Get historical yield trends for forecasting"""
        if self.crop_data is None:
            return {}
        
        crop_rows = self.crop_data[self.crop_data['Crop'] == crop]
        if len(crop_rows) == 0:
            return {}
        
        yield_cols = [col for col in crop_rows.columns if 'Yield' in col]
        trends = {}
        
        for col in yield_cols:
            year = col.split('-')[-1] if '-' in col else col
            values = crop_rows[col].values
            if len(values) > 0 and pd.notna(values[0]):
                trends[year] = float(values[0])
        
        return trends
    
    def get_price_statistics(self, commodity: str) -> Dict:
        """Get price statistics for risk calculation"""
        prices = self.get_commodity_prices(commodity, days=180)
        
        if len(prices) == 0:
            return {
                "mean": 2000,
                "std": 500,
                "min": 1000,
                "max": 5000,
                "volatility": 0.25
                , "source_type": "assumed", "observations": 0
            }
        
        modal_prices = prices['Modal_x0020_Price'].dropna()
        
        return {
            "mean": float(modal_prices.mean()),
            "std": float(modal_prices.std(ddof=0)),
            "min": float(modal_prices.min()),
            "max": float(modal_prices.max()),
            "volatility": float(modal_prices.std(ddof=0) / modal_prices.mean()) if len(modal_prices) > 1 else 0.25,
            "source_type": "historical_dataset",
            "observations": len(modal_prices)
        }
