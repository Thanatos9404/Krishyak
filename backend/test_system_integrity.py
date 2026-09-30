"""Regression tests for actual audit failures; no network or synthetic accuracy claims."""
import copy
import io
import json
import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch, Mock
import numpy as np
import pandas as pd
from PIL import Image
from fastapi.testclient import TestClient
from simulation_engine import SimulationEngine
from yield_estimator import YieldEstimator
from data_loader import DataLoader
from price_forecaster import PriceForecaster
from fertilizer_analyzer import FertilizerAnalyzer
from hybrid_inference import PredictionRouter
from pest_intelligence import PestDataCollector
import config
import main

PARAMS = dict(crop='Rice', soil_type='Clay', area_hectares=2, seed_quality=.8,
              expected_rainfall=800, rainfall_delay=5, irrigation_frequency=3,
              fertilizer_mix={'Urea': 100, 'DAP': 50, 'MOP': 30}, pest_probability=.2,
              pest_control_intensity=.5, labour_days=30, sale_month=3, current_market_price=2000)


class CalculationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = SimulationEngine()

    def test_zero_fertilizer_no_free_yield(self):
        y = self.engine.yield_estimator
        self.assertEqual(y._calculate_fertilizer_modifier('Rice', {}),
                         y._calculate_fertilizer_modifier('Rice', {'Urea': 0}))

    def test_excess_fertilizer_not_rewarded(self):
        y = self.engine.yield_estimator
        self.assertLess(y._calculate_fertilizer_modifier('Rice', {'Urea': 10000}),
                        y._calculate_fertilizer_modifier('Rice', PARAMS['fertilizer_mix']))

    def test_price_shock_preserved(self):
        low = self.engine._simulate_scenario({**PARAMS, 'current_market_price': 1000}, 'test')
        high = self.engine._simulate_scenario({**PARAMS, 'current_market_price': 2000}, 'test')
        self.assertAlmostEqual(high['revenue'], low['revenue'] * 2, places=2)
        self.assertAlmostEqual(high['costs']['breakdown']['market_fees'],
                               high['revenue'] * config.COST_PARAMS['market_fee_percent'] / 100, delta=.02)

    def test_sale_month_horizon(self):
        result = self.engine._simulate_scenario({**PARAMS, 'sale_month': 12}, 'test')
        self.assertEqual(len(result['price_forecast']['forecast_prices']), 361)

    def test_irrigation_season_cost(self):
        a = self.engine._simulate_scenario({**PARAMS, 'season_months': 1}, 'test')
        b = self.engine._simulate_scenario({**PARAMS, 'season_months': 4}, 'test')
        self.assertEqual(a['costs']['breakdown']['irrigation_cost'] * 4, b['costs']['breakdown']['irrigation_cost'])

    def test_monte_carlo_varies_and_preserves_input(self):
        original = copy.deepcopy(PARAMS)
        sampled = []
        real = self.engine._simulate_scenario
        def capture(params, scenario, **kwargs):
            sampled.append(params)
            return real(params, scenario, **kwargs)
        with patch.object(self.engine, '_simulate_scenario', side_effect=capture):
            summary = self.engine._run_micro_simulations(PARAMS, 30)
        self.assertEqual(PARAMS, original)
        self.assertEqual(len(set(p['expected_rainfall'] for p in sampled)), 30)
        self.assertGreater(summary['yield_stats']['std'], 0)
        self.assertGreater(summary['profit_stats']['std'], 0)

    def test_high_pest_input_not_reset_to_low(self):
        result = self.engine._run_micro_simulations({**PARAMS, 'pest_probability': .9}, 30)
        low = self.engine._run_micro_simulations({**PARAMS, 'pest_probability': .1}, 30)
        self.assertGreater(result['risk_stats']['mean'], low['risk_stats']['mean'])

    def test_no_global_rng_mutation(self):
        np.random.seed(17)
        expected = np.random.random(3)
        np.random.seed(17)
        self.engine._run_micro_simulations(PARAMS, 3)
        np.testing.assert_equal(np.random.random(3), expected)

    def test_single_market_date_not_history(self):
        loader = DataLoader()
        loader.price_data = pd.DataFrame({'Commodity': ['Rice', 'Rice', 'Rice Bran'],
            'Arrival_Date': ['06/11/2025'] * 3, 'Modal_x0020_Price': [1000, 3000, 9000]})
        loader._preprocess_price_data()
        rows = loader.get_commodity_prices('Rice')
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows.iloc[0]['Modal_x0020_Price'], 2000)
        self.assertEqual(rows.iloc[0]['Arrival_Date'].month, 11)
        self.assertTrue(np.isfinite(loader.get_price_statistics('Rice')['std']))

    def test_price_history_chronological(self):
        loader = DataLoader()
        loader.price_data = pd.DataFrame({'Commodity': ['Rice'] * 3,
            'Arrival_Date': pd.to_datetime(['2025-11-03', '2025-11-01', '2025-11-02']),
            'Modal_x0020_Price': [3000, 1000, 2000]})
        self.assertEqual(loader.get_commodity_prices('Rice')['Modal_x0020_Price'].tolist(), [1000, 2000, 3000])

    def test_no_fake_forecast_or_metadata(self):
        data = PriceForecaster().forecast_prices('Rice', 2345, 60)
        self.assertFalse(data['optimal_selling_window']['timing_supported'])
        self.assertEqual(set(data['forecast_prices']), {2345.0})
        for meta in (PredictionRouter.route_price('Rice', data)[1], PredictionRouter.route_simulation(PARAMS, {})[1]):
            self.assertNotEqual(meta.prediction_mode, 'ml_primary')
            self.assertIsNone(meta.confidence_score)

    def test_half_hectare_cost_per_hectare(self):
        analyzer = FertilizerAnalyzer()
        full = analyzer.get_recommendation('Rice', area_hectares=1)
        half = analyzer.get_recommendation('Rice', area_hectares=.5)
        self.assertEqual(full['cost_per_hectare'], half['cost_per_hectare'])
        self.assertEqual(analyzer.get_schedule('Rice', .5)['cost_per_hectare'],
                         analyzer.get_schedule('Rice', 1)['cost_per_hectare'])

    def test_doses_meet_nutrients_without_dap_nitrogen_oversupply(self):
        analyzer = FertilizerAnalyzer()
        for req in ({'N': 0, 'P': 100, 'K': 0}, {'N': 10, 'P': 100, 'K': 60}):
            doses = analyzer._calculate_chemical_doses(req, 1)
            for key in req:
                self.assertAlmostEqual(sum(d.npk_contribution[key] for d in doses), req[key])

    def test_soil_zero_is_measurement_and_missing_is_unknown(self):
        analyzer = FertilizerAnalyzer()
        data = analyzer.get_recommendation('Rice', {'N': 0, 'P': None, 'K': None, 'pH': 7})
        self.assertEqual(data['nutrient_gaps']['N']['soil_available'], 0)
        self.assertEqual(data['nutrient_gaps']['P']['status'], 'unknown')

    def test_all_configured_crops_return_finite_outputs(self):
        for crop in config.CROPS:
            result = self.engine._simulate_scenario({**PARAMS, 'crop': crop}, 'test')
            json.dumps(result, allow_nan=False)
            self.assertGreaterEqual(result['yield']['yield_per_hectare'], 0, crop)
            self.assertTrue(0 <= result['risk']['overall_risk_score'] <= 100, crop)

    def test_no_generated_government_outbreaks(self):
        collector = PestDataCollector()
        self.assertEqual(collector.get_government_alerts('Punjab'), [])
        self.assertEqual(collector.get_historical_outbreaks('rice', 'Punjab'), [])


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    def test_core_routes(self):
        for route in ['/health', '/crops', '/soils', '/fertilizers', '/diseases']:
            self.assertEqual(self.client.get(route).status_code, 200, route)

    def test_reject_negative_or_unknown_fertilizer(self):
        for mix in ({'Urea': -1}, {'mystery': 10}):
            res = self.client.post('/simulate', json={'farming_input': {**PARAMS, 'fertilizer_mix': mix}})
            self.assertEqual(res.status_code, 422)

    def test_simulate_finite(self):
        res = self.client.post('/simulate', json={'farming_input': PARAMS})
        self.assertEqual(res.status_code, 200, res.text)
        json.dumps(res.json(), allow_nan=False)
        self.assertNotEqual(res.json()['metadata']['prediction_mode'], 'ml_primary')

    def test_no_diagnosis_when_model_missing(self):
        image = io.BytesIO()
        Image.new('RGB', (8, 8), 'green').save(image, format='PNG')
        with patch('model_inference.load_model', side_effect=FileNotFoundError):
            response = self.client.post('/detect_disease', files={'file': ('x.png', image.getvalue(), 'image/png')})
        self.assertEqual(response.status_code, 503)

    def test_disease_catalog_strings(self):
        self.assertEqual(self.client.get('/diseases').status_code, 200)

    def test_identity_not_falsely_verified(self):
        from jam_trinity import JAMTrinityService
        service = JAMTrinityService('test-key')
        with patch.dict('os.environ', {'ENABLE_DEMO_IDENTITY': 'false'}):
            result = service.verify_aadhaar('1234', 'any-consent')
        self.assertFalse(result.verified)
        self.assertTrue(result.error)

    def test_zero_soil_endpoint(self):
        result = self.client.post('/fertilizer/recommendation', json={'crop': 'Rice', 'soil_n': 0})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()['soil_status']['N'], 'Low')


class DataSplitTests(unittest.TestCase):
    def test_generic_filenames_do_not_create_label_conflicts(self):
        import prepare_disease_manifest as prep
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pv = root / 'datasets/authentic/PlantVillage'
            pv.mkdir(parents=True)
            (pv / 'leaf-map.json').write_text('{}')
            (pv / 'source_revision.json').write_text('{"revision":"test"}')
            doc = root / 'datasets/authentic/PlantDoc-export'
            doc.mkdir(parents=True)
            (doc / 'provenance.json').write_text('{"revision":"test","records":[]}')
            model_dir = root / 'backend/models'
            model_dir.mkdir(parents=True)
            (model_dir / 'class_indices.json').write_text('{"0":"Healthy Wheat","1":"Cotton Aphid"}')
            for seed, label in enumerate(['Healthy Wheat', 'Cotton Aphid']):
                folder = root / 'datasets/pdisease/Train' / label
                folder.mkdir(parents=True)
                pixels = np.random.default_rng(seed).integers(0, 255, (20, 20, 3), dtype=np.uint8)
                Image.fromarray(pixels).save(folder / '00001.png')
            out = root / 'output'
            with patch.object(prep, 'ROOT', root), patch.object(prep.subprocess, 'check_output', return_value='test'), patch('builtins.print'):
                prep.build(out)
            audit = json.loads((out / 'data_audit.json').read_text())
            self.assertEqual(audit['classes'], 2)
            self.assertEqual(audit['conflicting_images_quarantined'], 0)


class WeatherTests(unittest.IsolatedAsyncioTestCase):
    async def test_unavailable_forecast_not_zero_rain(self):
        from weather_alerts import WeatherAlertService
        from unittest.mock import AsyncMock
        service = WeatherAlertService()
        with patch.object(service, 'get_forecast', new=AsyncMock(return_value=[])):
            result = await service.get_rain_forecast_summary(20, 75)
        self.assertFalse(result['available'])
        self.assertIsNone(result['total_rain_mm'])


class InferenceTests(unittest.TestCase):
    def predict(self, label, score=.98, crop='rice', image=None):
        from model_inference import predict_from_image
        model = Mock()
        model.predict.return_value = np.array([[score, 1-score]])
        stream = io.BytesIO()
        Image.new('RGB', (40, 40), 'green').save(stream, format='PNG')
        with patch('model_inference.load_model', return_value=(model, {'0': label, '1': 'Rice Blast'})):
            return predict_from_image(stream.getvalue() if image is None else image, crop)

    def test_healthy_is_not_converted_to_disease(self):
        from disease_detector import detect_disease_multisource
        healthy = self.predict('Rice___healthy')
        with patch('model_inference.predict_from_image', return_value=healthy):
            result = detect_disease_multisource(b'image', 'rice')
        self.assertEqual(result['status'], 'healthy')
        self.assertIsNone(result['disease'])
        self.assertEqual(len(result['sources']), 1)

    def test_crop_mismatch_abstains(self):
        self.assertEqual(self.predict('Healthy Wheat')['status'], 'uncertain')

    def test_low_confidence_no_treatment(self):
        result = self.predict('Rice Blast', .6)
        self.assertEqual(result['status'], 'uncertain')
        self.assertIsNone(result['treatment'])

    def test_malformed_image(self):
        self.assertEqual(self.predict('Rice Blast', image=b'not an image')['status'], 'invalid_image')


if __name__ == '__main__':
    unittest.main()
