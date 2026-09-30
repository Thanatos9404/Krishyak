import unittest
from unittest.mock import patch
from simulation_engine import SimulationEngine
from test_system_integrity import PARAMS


class SimulationContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = SimulationEngine()

    def test_snapshot_matches_uncached_calculations(self):
        for crop in ('Rice', 'Cotton', 'Wheat'):
            context = self.engine._prepare_context(crop)
            for price, month in ((1000, 0), (3000, 12)):
                params = {**PARAMS, 'crop': crop, 'current_market_price': price, 'sale_month': month}
                self.assertEqual(self.engine._simulate_scenario(params, 'test'),
                                 self.engine._simulate_scenario(params, 'test', context=context))

    def test_micro_statistics_match_uncached_reference(self):
        method = self.engine._simulate_scenario
        expected = self.engine._run_micro_simulations(PARAMS, 30)
        with patch.object(self.engine, '_simulate_scenario',
                          side_effect=lambda params, kind, **kwargs: method(params, kind)):
            self.assertEqual(expected, self.engine._run_micro_simulations(PARAMS, 30))

    def test_each_request_refreshes_observations_once(self):
        loader = self.engine.price_forecaster.data_loader
        with patch.object(loader, 'get_commodity_prices', wraps=loader.get_commodity_prices) as history:
            self.engine.run_whatif_simulation(PARAMS, 40)
            self.assertEqual(history.call_count, 1)
            self.engine.run_whatif_simulation({**PARAMS, 'crop': 'Cotton'}, 20)
            self.assertEqual(history.call_count, 2)

    def test_wrong_crop_snapshot_rejected(self):
        with self.assertRaises(ValueError):
            self.engine._simulate_scenario(PARAMS, 'test', context=self.engine._prepare_context('Cotton'))
