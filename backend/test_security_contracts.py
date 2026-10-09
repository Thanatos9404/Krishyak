import unittest

from security import FileValidator, InputSanitizer, generate_request_id, mask_sensitive_data


class SecurityTests(unittest.TestCase):
    def test_non_finite_numbers_and_booleans_rejected(self):
        for value in (float('nan'), float('inf'), float('-inf'), True, '3'):
            with self.subTest(value=value), self.assertRaises(ValueError):
                InputSanitizer.validate_numeric_range(value, 0, 100)
        self.assertEqual(InputSanitizer.validate_numeric_range(0, 0, 100), 0)

    def test_upload_mime_signature_must_agree(self):
        good = [(b'\xff\xd8\xffx', 'image/jpeg'), (b'\x89PNG\r\n\x1a\n', 'image/png'), (b'RIFF1234WEBP', 'image/webp')]
        for content, mime in good:
            FileValidator.validate_image_upload(content, mime)
        for content, mime in [(b'RIFF1234WAVE', 'image/webp'), (good[1][0], 'image/jpeg'), (b'', 'image/png'), (b'abc', 'text/html')]:
            with self.assertRaises(ValueError):
                FileValidator.validate_image_upload(content, mime)

    def test_nested_farmer_details_are_masked_without_mutation(self):
        original = {'reports': [{'mobileNumber': 'test-number', 'aadhaarNumber': 'test-id'}], 'safe': 'crop'}
        masked = mask_sensitive_data(original)
        self.assertEqual(masked['reports'][0]['mobileNumber'], '***MASKED***')
        self.assertEqual(masked['reports'][0]['aadhaarNumber'], '***MASKED***')
        self.assertEqual(original['reports'][0]['mobileNumber'], 'test-number')
        self.assertNotEqual(generate_request_id(), generate_request_id())


if __name__ == '__main__':
    unittest.main()
