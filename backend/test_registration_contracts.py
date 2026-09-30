import unittest
from pydantic import ValidationError
from main import FarmerRegistrationInput

class RegistrationAreaContracts(unittest.TestCase):
    def payload(self, **changes):
        return dict(fullName='Test Farmer', fatherName='Test Parent', mobileNumber='9876543210',
                    state='Punjab', district='Ludhiana', tehsil='Ludhiana', village='Village',
                    pinCode='141001', khasraNumber='Test', totalLandArea='1', landUnit='hectares',
                    ownershipType='owned', primaryCrop='Rice', farmingType='conventional',
                    consentData=True, consentTerms=True, **changes)

    def test_partition_rejects_excess_even_when_each_piece_fits(self):
        for parts in ({'irrigatedLand':'0.6','rainfedLand':'0.6'}, {'irrigatedLand':'1.1'}, {'rainfedLand':'1.1'}):
            with self.assertRaises(ValidationError):
                FarmerRegistrationInput(**self.payload(**parts))

    def test_zero_blank_and_partial_areas_are_valid(self):
        for parts in ({'irrigatedLand':'0','rainfedLand':'1'}, {'irrigatedLand':'','rainfedLand':''}, {'irrigatedLand':'0.2','rainfedLand':'0.3'}):
            model = FarmerRegistrationInput(**self.payload(**parts))
            self.assertEqual(model.totalLandArea, '1.0')

    def test_nonfinite_and_negative_optional_areas_rejected(self):
        for value in ('NaN', 'Infinity', '-1', 'invalid'):
            with self.assertRaises(ValidationError):
                FarmerRegistrationInput(**self.payload(irrigatedLand=value))

    def test_registration_persists_server_time_and_excludes_aadhaar(self):
        import csv
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from fastapi.testclient import TestClient
        from main import app
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'registrations.csv'
            with patch('main.FARMER_CSV_FILE', target), TestClient(app) as client:
                response = client.post('/register-farmer', json=self.payload(registeredAt='1900-01-01', aadhaarNumber='test-identifier'))
                self.assertEqual(response.status_code, 200)
                self.assertNotEqual(response.json()['data']['registeredAt'], '1900-01-01')
            with target.open(encoding='utf-8', newline='') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['aadhaarNumber'], '')
            self.assertEqual(rows[0]['registeredAt'], response.json()['data']['registeredAt'])

    def test_storage_failure_is_not_success_and_does_not_expose_internal_details(self):
        from unittest.mock import patch
        from fastapi.testclient import TestClient
        from main import app
        with patch('main.append_registration', side_effect=OSError('private profile and internal path')):
            with TestClient(app) as client:
                response = client.post('/register-farmer', json=self.payload())
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()['success'])
        self.assertNotIn('private profile', response.text)
