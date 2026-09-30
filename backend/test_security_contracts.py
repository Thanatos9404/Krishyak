import unittest
from datetime import datetime, timedelta
from security import InputSanitizer, FileValidator, mask_sensitive_data, generate_request_id
from jam_trinity import TokenManager, ConsentManager


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

    def test_consent_scope_expiry_and_revocation(self):
        manager = ConsentManager()
        consent = manager.create_consent('test', ['land_records'])
        self.assertTrue(manager.verify_consent(consent.consent_id, 'land_records'))
        self.assertFalse(manager.verify_consent(consent.consent_id, 'bank'))
        self.assertIs(manager.get_consent(consent.consent_id), consent)
        self.assertTrue(manager.revoke_consent(consent.consent_id))
        self.assertFalse(consent.is_valid())
        self.assertFalse(manager.revoke_consent('missing'))
        expired = manager.create_consent('test', ['land_records'], duration_hours=-1)
        self.assertFalse(manager.verify_consent(expired.consent_id, 'land_records'))

    def test_token_expiry_and_revocation(self):
        manager = TokenManager('test-key')
        token = manager.tokenize_aadhaar('1234', 'test-consent')
        self.assertEqual(manager.get_masked_reference(token), 'XXXX1234')
        self.assertTrue(manager.revoke_token(token))
        self.assertFalse(manager.validate_token(token))
        self.assertIsNone(manager.get_masked_reference(token))
        self.assertFalse(manager.revoke_token(token))
        token = manager.tokenize_aadhaar('1234', 'test-consent')
        manager._tokens[token]['expires'] = datetime.now() - timedelta(seconds=1)
        self.assertFalse(manager.validate_token(token))


if __name__ == '__main__':
    unittest.main()
