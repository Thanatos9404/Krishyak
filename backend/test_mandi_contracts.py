import unittest
from unittest.mock import AsyncMock, patch
import httpx
from fastapi.testclient import TestClient
import gov_api_service as gov
from main import app

class MandiFailureTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        gov.clear_cache()

    async def test_missing_key_does_not_call_provider(self):
        with patch.object(gov, 'DATA_GOV_API_KEY', ''), patch.object(gov.httpx, 'AsyncClient') as factory:
            result = await gov.fetch_mandi_prices()
            self.assertFalse(result['available'])
            self.assertEqual(result['error_code'], 'not_configured')
            factory.assert_not_called()

    async def test_empty_records_are_distinct_from_provider_failure(self):
        client = AsyncMock()
        with patch.object(gov, 'DATA_GOV_API_KEY', 'test'), patch.object(gov.httpx, 'AsyncClient') as factory:
            factory.return_value.__aenter__.return_value = client
            for payload, available in [({'records': [], 'total': 0}, True), ({}, False), ({'records': 'invalid'}, False)]:
                gov.clear_cache()
                client.get.return_value = httpx.Response(200, json=payload)
                result = await gov.fetch_mandi_prices()
                self.assertEqual(result['available'], available)
                self.assertEqual(result['prices'], [])

    def test_endpoint_validates_limit_and_preserves_unavailability(self):
        with TestClient(app) as client:
            for limit in (0, -1, 101):
                self.assertEqual(client.get(f'/api/mandi/prices?limit={limit}').status_code, 422)
            with patch('main.fetch_mandi_prices', AsyncMock(return_value={'available': False, 'prices': [], 'error': 'unavailable'})):
                result = client.get('/api/mandi/prices').json()
                self.assertFalse(result['success'])

    def test_cache_is_not_mutable_by_callers(self):
        value = {'prices': [{'modal_price': 10}]}
        gov._set_cache('test', value)
        value['prices'].clear()
        fetched = gov._get_cache('test')
        fetched['prices'].clear()
        self.assertEqual(gov._get_cache('test')['prices'][0]['modal_price'], 10)
