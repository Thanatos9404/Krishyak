import unittest
from fastapi.testclient import TestClient
from main import app
from fertilizer_analyzer import FertilizerAnalyzer, CROP_NPK_REQUIREMENTS

class FertilizerStageContracts(unittest.TestCase):
    def setUp(self):
        self.analyzer = FertilizerAnalyzer()

    def test_each_crop_schedule_conserves_nutrients(self):
        for crop, requirements in CROP_NPK_REQUIREMENTS.items():
            with self.subTest(crop=crop):
                totals = dict(N=0, P=0, K=0)
                for stage in requirements['stage_split']:
                    result = self.analyzer.get_recommendation(crop, growth_stage=stage)
                    for key in totals:
                        totals[key] += result['total_npk_applied'][key]
                for key in totals:
                    self.assertAlmostEqual(totals[key], requirements[key], delta=.3)

    def test_unscheduled_maturity_does_not_add_extra_third_dose(self):
        result = self.analyzer.get_recommendation('Rice', growth_stage='maturity')
        self.assertFalse(result['stage_scheduled'])
        self.assertEqual(result['recommendations'], [])
        self.assertEqual(result['total_cost_inr'], 0)

    def test_organic_amendments_are_not_repeated_at_every_stage(self):
        basal = self.analyzer.get_recommendation('Rice', prefer_organic=True)
        flowering = self.analyzer.get_recommendation('Rice', growth_stage='flowering', prefer_organic=True)
        self.assertTrue(basal['recommendations'])
        self.assertEqual(flowering['recommendations'], [])
        self.assertIn('plant-available nutrient release is not estimated', basal['application_note'])

    def test_invalid_area_and_stage_fail_validation(self):
        for area in (0, -1, float('nan'), float('inf'), True):
            for method in (self.analyzer.get_recommendation, self.analyzer.get_schedule):
                with self.assertRaises(ValueError):
                    method('Rice', area_hectares=area)
        with TestClient(app) as client:
            self.assertEqual(client.post('/fertilizer/recommendation', json={'crop':'Rice','growth_stage':'typo'}).status_code, 422)

    def test_schedule_cost_scales_with_fractional_area(self):
        full = self.analyzer.get_schedule('Rice')
        small = self.analyzer.get_schedule('Rice', .25)
        self.assertAlmostEqual(small['total_cost_inr'], full['total_cost_inr']*.25, delta=.02)
        self.assertEqual(small['cost_per_hectare'], full['cost_per_hectare'])
