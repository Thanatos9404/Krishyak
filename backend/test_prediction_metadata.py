import unittest
from datetime import datetime, timedelta
from hybrid_inference import PredictionRouter


class PredictionMetadataContracts(unittest.TestCase):
    def test_disease_router_does_not_assume_loaded_backbone(self):
        result = {'sources': [{'name': 'Trained ML Model'}],
                  'status': 'healthy', 'confidence': .85}
        returned, metadata = PredictionRouter.route_disease('apple', result, {})
        self.assertIs(returned, result)
        self.assertEqual(metadata.source_type, 'Image classifier')
        self.assertEqual(metadata.confidence_label, 'not_applicable')
        self.assertEqual(datetime.fromisoformat(metadata.record_date).utcoffset(), timedelta(0))

    def test_missing_classifier_is_unavailable(self):
        _, metadata = PredictionRouter.route_disease('apple', {'sources': [], 'status': 'unavailable'}, {})
        self.assertEqual(metadata.prediction_mode, 'unavailable')
        self.assertEqual(metadata.source_type, 'Unavailable')
        self.assertIsNone(metadata.confidence_score)
