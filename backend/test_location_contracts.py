import json
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
import gov_api_service as gov
from main import app

class LocationContracts(unittest.IsolatedAsyncioTestCase):
    async def test_lookup_by_code_name_and_unknown(self):
        by_name = await gov.fetch_districts(' Punjab ')
        self.assertTrue(by_name)
        self.assertEqual(by_name, await gov.fetch_districts('pb'))
        district = by_name[0]
        self.assertEqual(await gov.fetch_tehsils('PB', district['name'].lower()), district['tehsils'])
        self.assertEqual(await gov.fetch_districts('unknown'), [])
        self.assertEqual(await gov.fetch_tehsils('PB', 'unknown'), [])
        by_name.clear()
        self.assertTrue(await gov.fetch_districts('Punjab'))

    def test_shared_catalog_and_national_state_coverage(self):
        source = Path(__file__).resolve().parents[1] / 'frontend/src/data/location_suggestions.json'
        self.assertEqual(gov.LOCATION_SUGGESTIONS, json.loads(source.read_text(encoding='utf-8')))
        self.assertEqual({s['name'] for s in gov.get_all_states()}, {s['name'] for s in gov.LOCATION_SUGGESTIONS['states']})
        self.assertEqual(len(gov.get_all_states()), 36)
        states = gov.get_all_states()
        states.clear()
        self.assertEqual(len(gov.get_all_states()), 36)

    def test_endpoints_disclose_partial_suggestions(self):
        with TestClient(app) as client:
            for endpoint in ['/api/locations/districts?state=Punjab', '/api/locations/tehsils?state=Punjab&district=Ludhiana']:
                response = client.get(endpoint)
                self.assertEqual(response.status_code, 200)
                self.assertFalse(response.json()['complete'])
                self.assertTrue(response.json()['allows_free_entry'])
            self.assertEqual(client.get('/api/locations/districts').status_code, 422)
