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
