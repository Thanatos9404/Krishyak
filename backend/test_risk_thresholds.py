import unittest
from risk_engine import RiskEngine

class RiskThresholdTests(unittest.TestCase):
    def test_public_category_boundaries_match_displayed_index(self):
        engine = RiskEngine()
        for score, expected in [(0,'Low Risk'),(25,'Low Risk'),(25.01,'Moderate Risk'),
            (50,'Moderate Risk'),(50.01,'High Risk'),(75,'High Risk'),(75.01,'Severe Risk'),(100,'Severe Risk')]:
            with self.subTest(score=score):
                self.assertEqual(engine._categorize_risk(score),expected)
