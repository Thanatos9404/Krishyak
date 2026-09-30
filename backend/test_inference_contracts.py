import io
import unittest
from unittest.mock import Mock, patch
import numpy as np
from PIL import Image
from model_inference import predict_from_image

class InferenceOutputContracts(unittest.TestCase):
    def setUp(self):
        stream = io.BytesIO()
        Image.new('RGB', (8, 8), 'green').save(stream, format='PNG')
        self.image = stream.getvalue()
        self.labels = {'0': 'Apple___Apple_scab', '1': 'Apple___healthy'}

    def test_invalid_model_distributions_do_not_diagnose_or_blame_image(self):
        for output in ([[float('nan'), 0]], [[float('inf'), 0]], [[1.2, -.2]], [[.5, .7]], [[1]], [1, 0]):
            with self.subTest(output=output):
                model = Mock()
                model.predict.return_value = np.array(output)
                with patch('model_inference.load_model', return_value=(model, self.labels)):
                    result = predict_from_image(self.image, 'apple')
                self.assertEqual(result['status'], 'unavailable')
                self.assertNotIn('treatment', result)

    def test_model_runtime_failure_is_service_failure(self):
        model = Mock()
        model.predict.side_effect = RuntimeError('resource exhausted')
        with patch('model_inference.load_model', return_value=(model, self.labels)):
            self.assertEqual(predict_from_image(self.image)['status'], 'unavailable')

    def test_healthy_result_identifies_crop_and_rejects_mismatch(self):
        model = Mock()
        model.predict.return_value = np.array([[.1, .9]])
        with patch('model_inference.load_model', return_value=(model, self.labels)):
            result = predict_from_image(self.image, 'apple')
            mismatch = predict_from_image(self.image, 'rice')
        self.assertEqual(result['status'], 'healthy')
        self.assertEqual(result['crop_detected'], 'apple')
        self.assertEqual(mismatch['status'], 'uncertain')

    def test_invalid_image_never_calls_predict(self):
        model = Mock()
        with patch('model_inference.load_model', return_value=(model, self.labels)):
            self.assertEqual(predict_from_image(b'broken')['status'], 'invalid_image')
        model.predict.assert_not_called()

    def input_tensor(self, image, *, exif=None):
        stream = io.BytesIO()
        image.save(stream, format='PNG', **({'exif': exif} if exif else {}))
        model = Mock()
        model.predict.return_value = np.array([[.9, .1]])
        with patch('model_inference.load_model', return_value=(model, self.labels)):
            result = predict_from_image(stream.getvalue(), 'apple')
        self.assertEqual(result['status'], 'disease_detected')
        return model.predict.call_args.args[0]

    def test_transparent_pixels_match_visible_white_composite(self):
        for mode, color in [('RGBA', (255, 0, 0, 0)), ('LA', (0, 0))]:
            with self.subTest(mode=mode):
                with Image.new(mode, (8, 8), color) as transparent:
                    values = self.input_tensor(transparent)
                np.testing.assert_array_equal(values, np.ones_like(values))
        with Image.new('RGBA', (8, 8), (255, 0, 0, 128)) as partial:
            values = self.input_tensor(partial)
        np.testing.assert_allclose(values[0, 0, 0], [1, 127/255, 127/255], atol=1e-7)

    def test_palette_transparency_does_not_expose_hidden_color(self):
        with Image.new('P', (8, 8), 0) as image:
            image.putpalette([255, 0, 0] + [0] * 765)
            image.info['transparency'] = 0
            values = self.input_tensor(image)
        np.testing.assert_array_equal(values, np.ones_like(values))

    def test_exif_rotation_matches_upright_pixels(self):
        with Image.new('RGB', (12, 8), 'green') as image:
            image.paste('red', (0, 0, 6, 8))
            orientation = Image.Exif()
            orientation[274] = 6
            rotated_input = self.input_tensor(image, exif=orientation)
            with image.transpose(Image.Transpose.ROTATE_270) as upright:
                upright_input = self.input_tensor(upright)
        np.testing.assert_array_equal(rotated_input, upright_input)

    def test_new_class_crop_and_float32_preprocessing(self):
        model = Mock()
        model.predict.return_value = np.array([[.9, .1]])
        with patch('model_inference.load_model', return_value=(model, self.labels)):
            result = predict_from_image(self.image, 'apple')
        self.assertEqual(result['crop_detected'], 'apple')
        self.assertIsNone(result['disease']['severity'])
        self.assertEqual(result['disease']['severity_source'], 'not_measured')
        values = model.predict.call_args.args[0]
        self.assertEqual(values.dtype, np.float32)
        self.assertEqual(values.shape, (1, 224, 224, 3))
