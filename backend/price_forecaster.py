"""Price forecasting using time series models"""
import numpy as np
import pandas as pd
from typing import Dict, List
from datetime import datetime, timedelta
from data_loader import DataLoader
from mandi_adapter import mandi_adapter

class PriceForecaster:
    """Forecast commodity prices using statistical methods"""
    
    def __init__(self):
        self.data_loader = DataLoader()
    
    def forecast_prices(
        self,
        commodity: str,
        current_price: float,
        forecast_days: int = 60
    ) -> Dict:
        """
        Forecast prices for next N days
        Uses simplified trend + seasonality + noise model
        """
        # Get historical price data
        historical = self.data_loader.get_commodity_prices(commodity, days=180)
        
        if len(historical) > 10:
            # Use historical data for forecasting
            prices = historical['Modal_x0020_Price'].dropna().values
            trend, volatility = self._calculate_trend_and_volatility(prices)
        else:
            # Use default patterns
            trend = 0.001  # Slight upward trend
            volatility = 0.15
            prices = np.array([current_price] * 30)
        
        # Fetch live mandi price logic
        mandi_data = mandi_adapter.get_current_mandi_price(commodity)
        actual_current_price = mandi_data["price"] if mandi_data else current_price
        
        # Generate forecast
        forecast = self._generate_forecast(
            actual_current_price, trend, volatility, forecast_days
        )
        
        # Find optimal selling window
        selling_window = self._find_optimal_selling_window(forecast)
        
        # Price statistics
        stats = {
            "mean_forecast": round(np.mean(forecast), 2),
            "min_forecast": round(np.min(forecast), 2),
            "max_forecast": round(np.max(forecast), 2),
            "std_deviation": round(np.std(forecast), 2)
        }
        
        return {
            "forecast_prices": [round(p, 2) for p in forecast],
            "forecast_dates": self._generate_date_range(forecast_days),
            "current_price": actual_current_price,
            "statistics": stats,
            "optimal_selling_window": selling_window,
            "trend": "Upward" if trend > 0.005 else "Downward" if trend < -0.005 else "Stable",
            "volatility_level": "High" if volatility > 0.25 else "Moderate" if volatility > 0.15 else "Low",
            "source_metadata": {
                "source_type": mandi_data.get("source_type", "static_fallback") if mandi_data else "static_fallback",
                "source_label": mandi_data.get("source_label", "System Default") if mandi_data else "System Default",
                "freshness_status": mandi_data.get("freshness_status", "static") if mandi_data else "static",
                "record_date": mandi_data.get("record_date", None) if mandi_data else None,
                "transparency_note": mandi_data.get("transparency_note", "") if mandi_data else ""
            }
        }
    
    def _calculate_trend_and_volatility(self, prices: np.ndarray) -> tuple:
        """Calculate price trend and volatility from historical data"""
        if len(prices) < 2:
            return 0, 0.15
        
        # Calculate daily returns
        returns = np.diff(prices) / prices[:-1]
        
        # Trend (average daily return)
        trend = np.mean(returns)
        
        # Volatility (std of returns)
        volatility = np.std(returns)
        
        return trend, max(0.05, volatility)
    
    def _generate_forecast(
        self,
        current_price: float,
        trend: float,
        volatility: float,
        days: int
    ) -> np.ndarray:
        """Generate price forecast using stochastic model"""
        np.random.seed(42)  # For reproducibility
        
        forecast = np.zeros(days)
        forecast[0] = current_price
        
        # Seasonal pattern (simplified)
        seasonal_pattern = self._generate_seasonal_pattern(days)
        
        for i in range(1, days):
            # Random walk with drift + seasonality
            drift = trend
            shock = np.random.normal(0, volatility)
            seasonal = seasonal_pattern[i]
            
            # Price evolution
            price_change = forecast[i-1] * (drift + shock + seasonal)
            forecast[i] = max(current_price * 0.5, forecast[i-1] + price_change)
        
        return forecast
    
    def _generate_seasonal_pattern(self, days: int) -> np.ndarray:
        """Generate simplified seasonal pattern"""
        # Assume 30-day cycle with some seasonality
        t = np.arange(days)
        pattern = 0.02 * np.sin(2 * np.pi * t / 30)  # ±2% seasonal variation
        return pattern
    
    def _find_optimal_selling_window(self, forecast: np.ndarray) -> Dict:
        """Find best time window to sell for maximum profit"""
        # Find peak price period
        peak_idx = np.argmax(forecast)
        peak_price = forecast[peak_idx]
        
        # Find good selling window (within 5% of peak)
        threshold = peak_price * 0.95
        good_days = np.where(forecast >= threshold)[0]
        
        if len(good_days) > 0:
            start_day = int(good_days[0])
            end_day = int(good_days[-1])
            recommended_day = peak_idx
        else:
            start_day = 0
            end_day = len(forecast) - 1
            recommended_day = peak_idx
        
        return {
            "recommended_day": int(recommended_day),
            "window_start_day": start_day,
            "window_end_day": end_day,
            "expected_peak_price": round(float(peak_price), 2),
            "recommendation": f"Current statistical models project a 60-day market peak around {recommended_day} days from today (a favorable selling window is estimated between {start_day} and {end_day} days from today)."
        }
    
    def _generate_date_range(self, days: int) -> List[str]:
        """Generate list of future dates"""
        start_date = datetime.now()
        dates = [(start_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
        return dates
