import json
import unittest
from unittest.mock import patch
import pandas as pd
import numpy as np
from price_forecaster import PriceForecaster
from data_loader import DataLoader

class PriceContracts(unittest.TestCase):
    def setUp(self):
        self.forecaster=PriceForecaster()

    def test_invalid_price_and_horizon_rejected(self):
        for price in (True,0,-1,float('inf'),1000000001):
            with self.assertRaises(ValueError):
                self.forecaster.forecast_prices('Rice',price)
        for days in (True,0,1.5,367):
            with self.assertRaises(ValueError):
                self.forecaster.forecast_prices('Rice',2000,days)

    def test_old_or_invalid_api_price_does_not_override_user_quote(self):
        for price,freshness in ((2200,'stale'),(float('nan'),'live'),(-1,'live')):
            with patch('price_forecaster.mandi_adapter.get_current_mandi_price',return_value={'price':price,'source_type':'live_api','freshness_status':freshness}):
                result=self.forecaster.forecast_prices('Rice',2000,use_market_price=True)
            self.assertEqual(result['current_price'],2000)
            self.assertEqual(result['source_metadata']['source_type'],'user_input')

    def test_sparse_observations_do_not_imply_daily_return_support(self):
        history=pd.DataFrame({'Arrival_Date':pd.date_range('2025-01-01',periods=30,freq='7D'),'Modal_x0020_Price':np.arange(30)+2000})
        with patch.object(self.forecaster.data_loader,'get_commodity_prices',return_value=history):
            result=self.forecaster.forecast_prices('Rice',2000)
        self.assertEqual(result['consecutive_returns'],0)
        self.assertIsNone(result['prediction_interval'])

    def test_extreme_history_interval_stays_json_serializable(self):
        history=pd.DataFrame({'Arrival_Date':pd.date_range('2025-01-01',periods=30),'Modal_x0020_Price':[1e-100,1e100]*15})
        with patch.object(self.forecaster.data_loader,'get_commodity_prices',return_value=history):
            result=self.forecaster.forecast_prices('Rice',2000)
        self.assertIsNone(result['prediction_interval'])
        self.assertIn('interval_unavailable_reason',result)
        json.dumps(result,allow_nan=False)

    def test_nonfinite_prices_excluded_before_daily_aggregation(self):
        loader=DataLoader()
        loader.price_data=pd.DataFrame({'Commodity':['Rice']*3,'Arrival_Date':pd.to_datetime(['2025-01-01']*3),'Modal_x0020_Price':[2000,float('inf'),float('nan')]})
        self.assertEqual(loader.get_price_statistics('Rice')['mean'],2000)

    def test_simulation_price_shocks_can_exceed_user_input_ceiling(self):
        from simulation_engine import SimulationEngine
        from test_system_integrity import PARAMS
        result=SimulationEngine()._run_micro_simulations({**PARAMS,'current_market_price':10000000},3)
        self.assertTrue(np.isfinite(result['profit_stats']['mean']))
