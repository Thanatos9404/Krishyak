import copy
import unittest
from simulation_engine import SimulationEngine
from test_system_integrity import PARAMS

class ScenarioContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = SimulationEngine()

    def test_stress_parameters_do_not_improve_extreme_inputs(self):
        for seed in (0, .1, .8, 1):
            for pest in (0, .2, .99, 1):
                params = {**PARAMS, 'seed_quality': seed, 'pest_probability': pest, 'pest_control_intensity': 0}
                worst = self.engine._generate_worst_case(params)
                self.assertLessEqual(worst['seed_quality'], seed)
                self.assertGreaterEqual(worst['pest_probability'], pest)
                self.assertLessEqual(worst['pest_control_intensity'], params['pest_control_intensity'])
                self.assertLessEqual(worst['current_market_price'], params['current_market_price'])

    def test_optimal_control_does_not_reduce_existing_intensity(self):
        for intensity in (.5, .95, 1):
            result = self.engine._optimize_parameters({**PARAMS, 'pest_control_intensity': intensity})
            self.assertGreaterEqual(result['pest_control_intensity'], intensity)

    def test_scenario_snapshot_is_independent_of_input_mutation(self):
        params = copy.deepcopy(PARAMS)
        result = self.engine._simulate_scenario(params, 'current')
        params['fertilizer_mix']['Urea'] = 9999
        self.assertEqual(result['parameters_used']['fertilizer_mix']['Urea'], 100)

    def test_complete_comparison_preserves_inputs_and_profit_fallback(self):
        params = copy.deepcopy(PARAMS)
        original = copy.deepcopy(params)
        result = self.engine.run_whatif_simulation(params, 5)
        self.assertEqual(params, original)
        self.assertGreaterEqual(result['ai_optimal_plan']['profit'], result['current_plan']['profit'])
        self.assertEqual(result['micro_simulations_summary']['num_simulations'], 5)
        self.assertIn('No validated sale-date advantage', result['recommendation'])

    def test_sample_counts_reject_zero_fraction_and_boolean(self):
        for count in (0, -1, 1.5, True, 2001):
            for method in (self.engine.run_whatif_simulation, self.engine._run_micro_simulations):
                with self.assertRaises(ValueError):
                    method(PARAMS, count)
