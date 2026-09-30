import unittest
from unittest.mock import patch
from datetime import datetime
from fastapi.testclient import TestClient
from main import app
from pest_intelligence import OutbreakPredictor, PestAnalyzer, PEST_DATABASE

class PestCalculationContracts(unittest.TestCase):
    def test_no_mock_regional_claims_or_coordinate_based_score_changes(self):
        predictor = OutbreakPredictor()
        weather = dict(temperature=28, humidity=80, rainfall=0)
        first = predictor.predict_outbreak('rice', weather, 29, 75)
        second = predictor.predict_outbreak('rice', weather, 10, 77)
        self.assertTrue(first)
        self.assertEqual([p.probability for p in first], [p.probability for p in second])
        for item in first:
            self.assertFalse(item.to_dict()['regional_data_available'])
            self.assertFalse(any('regional' in factor.lower() for factor in item.factors))
            self.assertTrue(0 <= item.probability <= 1)
        self.assertFalse(PestAnalyzer().get_risk_by_location(29, 75, 'rice')['available'])

    def test_missing_or_nonfinite_weather_rejected(self):
        predictor = OutbreakPredictor()
        for value in (None, float('nan'), True, -11):
            with self.assertRaises(ValueError):
                predictor.predict_outbreak('rice', dict(temperature=value, humidity=70, rainfall=0), 20, 78)
        with TestClient(app) as client:
            response = client.post('/pest/prediction', json={'crop': 'Rice', 'lat': 20, 'lon': 78})
            self.assertEqual(response.status_code, 422)

    def test_season_wraps_december_to_january_and_unknown_is_unavailable(self):
        analyzer = PestAnalyzer()
        self.assertIsNone(analyzer.get_seasonal_risk('unknown')['risk_level'])
        with patch('pest_intelligence.datetime') as clock, patch.dict(PEST_DATABASE, {'test': {'pest': {'peak_months': [12]}}}):
            clock.now.return_value = datetime(2026, 1, 15)
            self.assertEqual(analyzer.get_seasonal_risk('test')['risk_level'], 'medium')
