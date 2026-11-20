import json
import unittest
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import Mock, mock_open, patch

import model_inference as inference


class ModelLoadingTests(unittest.TestCase):
    def setUp(self):
        self.candidate = SimpleNamespace(input_shape=(None,224,224,3),output_shape=(None,2))
        self.loader = Mock(return_value=self.candidate)
        tensorflow = SimpleNamespace(keras=SimpleNamespace(models=SimpleNamespace(load_model=self.loader)))
        for patcher in [patch.dict('sys.modules', {'tensorflow':tensorflow}),
                        patch.object(inference, '_model', None), patch.object(inference, '_class_indices', None),
                        patch.object(inference, 'tf', None), patch.object(inference, 'keras', None),
                        patch.object(inference, 'MODEL_PATH', 'synthetic-model.keras'),
                        patch('model_inference.os.path.exists', return_value=True)]:
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_concurrent_first_requests_share_one_complete_model(self):
        labels = {'0':'Rice Blast','1':'Rice Healthy'}
        with patch('builtins.open', mock_open(read_data=json.dumps(labels))):
            with ThreadPoolExecutor(max_workers=8) as executor:
                results = list(executor.map(lambda _: inference.load_model(), range(16)))
        self.loader.assert_called_once()
        for model, mapping in results:
            self.assertIs(model, self.candidate)
            self.assertEqual(mapping, labels)

    def test_invalid_class_maps_never_publish_partial_cache(self):
        for labels in [{}, ['Rice','Wheat'], {'00':'Rice','1':'Wheat'},
                       {'0':None,'1':'Wheat'}, {'0':{},'1':'Wheat'},
                       {'0':' ','1':'Wheat'}, {'0':'Rice','1':'Rice'}]:
            with self.subTest(labels=labels), patch('builtins.open', mock_open(read_data=json.dumps(labels))):
                with self.assertRaises(ValueError):
                    inference.load_model()
                self.assertIsNone(inference._model)
                self.assertIsNone(inference._class_indices)

    def test_failed_load_can_retry_after_bundle_is_fixed(self):
        with patch('builtins.open', mock_open(read_data='{"0":"Rice"}')):
            with self.assertRaises(ValueError):
                inference.load_model()
        with patch('builtins.open', mock_open(read_data='{"0":"Rice","1":"Wheat"}')):
            model, labels = inference.load_model()
        self.assertIs(model, self.candidate)
        self.assertEqual(labels, {'0':'Rice','1':'Wheat'})

    def test_multi_output_shape_is_rejected(self):
        self.candidate.output_shape = [(None,2),(None,2)]
        with patch('builtins.open', mock_open(read_data='{"0":"Rice","1":"Wheat"}')):
            with self.assertRaises(ValueError):
                inference.load_model()
        self.assertIsNone(inference._model)

    def test_any_square_rgb_input_size_loads_and_other_shapes_are_rejected(self):
        self.candidate.input_shape = (None,288,288,3)
        with patch('builtins.open', mock_open(read_data='{"0":"Rice","1":"Wheat"}')):
            model, _ = inference.load_model()
        self.assertEqual(inference.image_size(model), (288,288))
        for shape in [(None,288,224,3), (None,288,288,1), (None,32,32,3), (None,None,None,3)]:
            with self.subTest(shape=shape), patch.object(inference, '_model', None):
                self.candidate.input_shape = shape
                with patch('builtins.open', mock_open(read_data='{"0":"Rice","1":"Wheat"}')):
                    with self.assertRaises(ValueError):
                        inference.load_model()

    def test_a_release_decision_rule_is_validated(self):
        def rule(decision):
            with patch('pathlib.Path.read_text', return_value=json.dumps({'decision': decision})):
                return inference.release_decision()
        self.assertEqual(rule(None), inference.DEFAULT_DECISION)
        self.assertEqual(rule({'threshold':.62,'crop_conditioned':True,'crop_mass_min':.3}),
                         {'threshold':.62,'crop_conditioned':True,'crop_mass_min':.3})
        for bad in [{'threshold':.1}, {'threshold':'high'}, {'threshold':.7,'crop_mass_min':2},
                    {'threshold':.7,'crop_conditioned':'yes'}]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                rule(bad)
