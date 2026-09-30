import unittest
from risk_engine import RiskEngine

class RiskEvidenceContracts(unittest.TestCase):
    def risk(self, stats, **changes):
        args=dict(crop='Rice',soil_type='Clay',expected_rainfall=800,rainfall_delay=0,pest_probability=.2,price_statistics=stats,yield_confidence=.8)
        args.update(changes)
        return RiskEngine().calculate_risk_score(**args)

    def test_missing_and_single_observation_are_not_measured_volatility(self):
        for stats in ({},{'volatility':.01,'source_type':'assumed','observations':0},
                      {'volatility':.01,'source_type':'historical_dataset','observations':1},
                      {'volatility':float('nan'),'source_type':'historical_dataset','observations':50}):
            result=self.risk(stats)
            self.assertEqual(result['component_evidence']['price'],'assumed_baseline_insufficient_history')
            self.assertTrue(any('insufficient' in item for item in result['insights']))

    def test_observed_dispersion_does_not_claim_future_stability(self):
        result=self.risk({'volatility':.01,'source_type':'historical_dataset','observations':20})
        self.assertEqual(result['component_evidence']['price'],'historical_price_dispersion')
        self.assertTrue(any('future stability is not established' in item for item in result['insights']))

    def test_invalid_inputs_cannot_produce_extreme_or_nonfinite_scores(self):
        for field,value in [('yield_confidence',2),('pest_probability',-1),('expected_rainfall',float('nan')),('rainfall_delay',True)]:
            with self.assertRaises(ValueError):
                self.risk({},**{field:value})
