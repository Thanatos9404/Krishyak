"""Transparent price baseline; uncertainty is not a random selling signal."""
from datetime import datetime, timedelta
import numpy as np
from data_loader import DataLoader
from mandi_adapter import mandi_adapter


class PriceForecaster:
    def __init__(self):
        self.data_loader = DataLoader()

    def forecast_prices(self, commodity, current_price, forecast_days=60, use_market_price=False, *, history=None):
        if (isinstance(current_price, bool) or not isinstance(current_price, (int, float))
                or not np.isfinite(current_price) or not 0 < current_price <= 1000000000
                or isinstance(forecast_days, bool) or not isinstance(forecast_days, int)
                or not 1 <= forecast_days <= 366):
            raise ValueError('Price must be positive, finite and at most 1000000000; horizon must be an integer from 1 to 366')
        if history is None:
            history = self.data_loader.get_commodity_prices(commodity, days=180)
        prices = history['Modal_x0020_Price'].to_numpy() if len(history) else np.array([])
        returns = np.array([])
        if len(prices) > 1:
            consecutive = history['Arrival_Date'].diff().dt.days.to_numpy()[1:] == 1
            returns = np.diff(np.log(prices))[consecutive]
        supported = len(returns) >= 20
        volatility = float(np.std(returns, ddof=1)) if supported else None
        market = mandi_adapter.get_current_mandi_price(commodity) if use_market_price else None
        live_market = (market and market.get('source_type') == 'live_api'
                       and market.get('freshness_status') == 'live'
                       and isinstance(market.get('price'), (int, float))
                       and not isinstance(market['price'], bool)
                       and np.isfinite(market['price']) and 0 < market['price'] <= 1000000000)
        anchor = float(market['price']) if live_market else current_price
        forecast = self._generate_forecast(anchor, 0.0, volatility, forecast_days)
        metadata = {
            'source_type': 'user_input', 'source_label': 'Entered market price',
            'freshness_status': 'user_supplied', 'record_date': None,
            'transparency_note': 'Persistence baseline, not a validated price prediction. No evidence-based best sale date.'
        }
        if live_market:
            metadata.update({k: v for k, v in market.items() if k != 'price'})
        result = {
            'forecast_prices': forecast.round(2).tolist(),
            'forecast_dates': self._generate_date_range(forecast_days), 'current_price': anchor,
            'statistics': {'mean_forecast': float(np.mean(forecast)), 'min_forecast': float(np.min(forecast)),
                           'max_forecast': float(np.max(forecast)), 'std_deviation': float(np.std(forecast))},
            'optimal_selling_window': self._find_optimal_selling_window(forecast), 'trend': 'Stable',
            'volatility_level': ('High' if volatility > .025 else 'Moderate' if volatility > .015 else 'Low') if supported else 'Unknown',
            'source_metadata': metadata, 'method': 'persistence_baseline',
            'historical_days': len(prices), 'consecutive_returns': len(returns),
            'forecast_validated': False, 'prediction_interval': None,
        }
        if supported:
            spread = 1.96 * volatility * np.sqrt(np.arange(forecast_days))
            with np.errstate(over='ignore', invalid='ignore'):
                lower = forecast * np.exp(-spread)
                upper = forecast * np.exp(spread)
            if np.all(np.isfinite(lower)) and np.all(np.isfinite(upper)):
                result['prediction_interval'] = {
                    'lower': lower.round(2).tolist(), 'upper': upper.round(2).tolist(),
                    'kind': 'uncalibrated_log_return_interval',
                }
            else:
                result['interval_unavailable_reason'] = 'Historical variability exceeds the numeric range supported by this interval method.'
        return result

    def _calculate_trend_and_volatility(self, prices):
        prices = np.asarray(prices, dtype=float)
        prices = prices[np.isfinite(prices) & (prices > 0)]
        if len(prices) < 3:
            return 0.0, 0.0
        returns = np.diff(np.log(prices))
        return float(np.mean(returns)), float(np.std(returns, ddof=1))

    def _generate_forecast(self, current_price, trend, volatility, days):
        return current_price * np.exp(trend * np.arange(days))

    def _find_optimal_selling_window(self, forecast):
        return {'recommended_day': 0, 'window_start_day': 0, 'window_end_day': len(forecast) - 1,
                'expected_peak_price': float(np.max(forecast)), 'timing_supported': False,
                'recommendation': 'No validated selling window is available. Compare current local quotes and storage costs.'}

    def _generate_date_range(self, days):
        start = datetime.now()
        return [(start + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days)]
