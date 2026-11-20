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


class CropConditionedDecision(unittest.TestCase):
    """A release may answer only among the selected crop's conditions, with its own threshold."""

    def setUp(self):
        stream = io.BytesIO()
        Image.new('RGB', (8, 8), 'green').save(stream, format='PNG')
        self.image = stream.getvalue()
        self.labels = {'0': 'Apple___Apple_scab', '1': 'Apple___healthy', '2': 'Rice___Blast'}
        rule = {'threshold': 0.6, 'crop_conditioned': True, 'crop_mass_min': 0.3}
        patcher = patch('model_inference._decision', rule)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_model(self, scores, crop, shape=(None, 288, 288, 3)):
        model = Mock(input_shape=shape)
        model.predict.return_value = np.array([scores])
        with patch('model_inference.load_model', return_value=(model, self.labels)):
            return predict_from_image(self.image, crop), model

    def test_only_the_selected_crops_conditions_compete(self):
        result, model = self.run_model([.35, .05, .6], 'apple')
        self.assertEqual(result['status'], 'disease_detected')
        self.assertEqual(result['disease']['name'], 'Apple___Apple_scab')
        self.assertAlmostEqual(result['disease']['confidence'], .875, places=5)
        self.assertEqual([row['class'] for row in result['top_predictions']],
                         ['Apple___Apple_scab', 'Apple___healthy'])
        # The photograph is resized to the model's own input size.
        self.assertEqual(model.predict.call_args.args[0].shape, (1, 288, 288, 3))

    def test_a_photograph_that_is_mostly_another_crop_gets_no_answer(self):
        result, _ = self.run_model([.1, .1, .8], 'apple')
        self.assertEqual(result['status'], 'uncertain')
        self.assertIn('does not match the selected crop', result['message'])
        self.assertIsNone(result['disease'])

    def test_a_close_call_inside_the_crop_gets_no_answer(self):
        result, _ = self.run_model([.3, .3, .4], 'apple')
        self.assertEqual(result['status'], 'uncertain')
        self.assertIn('uncertain', result['message'])

    def test_without_a_selected_crop_every_class_competes(self):
        result, _ = self.run_model([.35, .05, .6], None)
        self.assertEqual(result['status'], 'disease_detected')
        self.assertEqual(result['disease']['name'], 'Rice___Blast')

    def test_an_unsupported_crop_is_refused_before_any_class_is_named(self):
        result, _ = self.run_model([.35, .05, .6], 'banana')
        self.assertEqual(result['status'], 'uncertain')
        self.assertIn('not supported', result['message'])

    def test_mirror_averaging_scores_the_photograph_and_its_mirror(self):
        rule = {'threshold': 0.6, 'crop_conditioned': True, 'crop_mass_min': 0.3, 'mirror_averaging': True}
        stream = io.BytesIO()
        with Image.new('RGB', (8, 8), 'green') as image:
            image.paste('red', (0, 0, 4, 8))
            image.save(stream, format='PNG')
        model = Mock(input_shape=(None, 8, 8, 3))
        model.predict.side_effect = [np.array([[.9, .05, .05]]), np.array([[.5, .45, .05]])]
        with patch('model_inference._decision', rule), \
                patch('model_inference.load_model', return_value=(model, self.labels)):
            result = predict_from_image(stream.getvalue(), 'apple')
        self.assertEqual(model.predict.call_count, 2)
        first, second = (call.args[0] for call in model.predict.call_args_list)
        np.testing.assert_array_equal(second, first[:, :, ::-1, :])
        self.assertFalse(np.array_equal(first, second))
        # (0.9 + 0.5) / 2 = 0.7 of 0.95 on apple classes.
        self.assertAlmostEqual(result['disease']['confidence'], .7 / .95, places=5)
