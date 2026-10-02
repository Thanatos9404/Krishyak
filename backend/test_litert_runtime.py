import numpy as np
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
import model_inference
class Interpreter:
    def __init__(self, **kwargs): self.value = None
    def allocate_tensors(self): pass
    def get_input_details(self): return [{'index': 0, 'shape': np.array([1,224,224,3]), 'dtype': np.float32}]
    def get_output_details(self): return [{'index': 1, 'shape': np.array([1,2]), 'dtype': np.float32}]
    def set_tensor(self,index,value):
        self.value = float(value[0,0,0,0])
        import time
        time.sleep(.002)
    def invoke(self): pass
    def get_tensor(self,index): return np.array([[self.value,1-self.value]],dtype=np.float32)
class LiteRTTests(unittest.TestCase):
    def classifier(self):
        from types import SimpleNamespace
        with patch.dict('sys.modules', {'ai_edge_litert': SimpleNamespace(), 'ai_edge_litert.interpreter': SimpleNamespace(Interpreter=Interpreter)}):
            return model_inference.LiteRTClassifier('unused')
    def test_concurrent_requests_do_not_mix_image_results(self):
        model=self.classifier()
        values=[np.full((1,224,224,3),i/20,dtype=np.float32) for i in range(20)]
        with ThreadPoolExecutor(max_workers=8) as executor:
            results=list(executor.map(model.predict,values))
        for index,result in enumerate(results):
            np.testing.assert_allclose(result,[[index/20,1-index/20]],atol=1e-7)
    def test_rejects_wrong_input_shape_and_quantized_values(self):
        model=self.classifier()
        for values in [np.ones((2,224,224,3),np.float32),np.ones((1,224,224,3),np.uint8)]:
            with self.assertRaises(ValueError): model.predict(values)

class LiteRTBundleIntegrityTests(unittest.TestCase):
    def test_modified_weights_or_label_map_fail_before_model_publication(self):
        import tempfile, json, hashlib
        from pathlib import Path
        from types import SimpleNamespace
        for corrupt in ['weights','labels','none']:
            with self.subTest(corrupt=corrupt), tempfile.TemporaryDirectory() as directory:
                bundle=Path(directory)
                weights=b'float32-test-artifact'
                labels=b'{"0":"Apple___healthy","1":"Apple___Apple_scab"}'
                (bundle/'model.tflite').write_bytes(weights if corrupt!='weights' else b'corrupt')
                (bundle/'class_indices.json').write_bytes(labels if corrupt!='labels' else b'{"0":"Rice","1":"Wheat"}')
                (bundle/'runtime-verification.json').write_text(json.dumps({'artifact_sha256':hashlib.sha256(weights).hexdigest(),'class_indices_sha256':hashlib.sha256(labels).hexdigest()}))
                candidate=SimpleNamespace(input_shape=(1,224,224,3),output_shape=(1,2))
                with patch.object(model_inference,'MODEL_PATH',str(bundle/'model.tflite')), patch.object(model_inference,'CLASS_INDICES_PATH',str(bundle/'class_indices.json')), patch.object(model_inference,'_model',None), patch.object(model_inference,'_class_indices',None), patch.object(model_inference,'LiteRTClassifier',return_value=candidate) as loader:
                    if corrupt=='none':
                        self.assertIs(model_inference.load_model()[0],candidate)
                        loader.assert_called_once()
                    else:
                        with self.assertRaises(ValueError): model_inference.load_model()
                        loader.assert_not_called()
                        self.assertIsNone(model_inference._model)
