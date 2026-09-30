import unittest
from unittest.mock import patch, MagicMock
import httpx
from mandi_adapter import MandiPriceAdapter

class MandiAdapterContracts(unittest.TestCase):
    def test_live_filters_dates_and_invalid_price(self):
        adapter = MandiPriceAdapter()
        adapter.enable_live_fetch = True
        adapter.api_key = 'test'
        good = dict(commodity='Wheat', state='Punjab', district='Ludhiana', arrival_date='01/09/2026', modal_price='2200')
        rows = [{**good, 'district': 'Other'}, {**good, 'modal_price': 'NaN'},
                {**good, 'arrival_date': '01/01/2099'}, {**good, 'arrival_date': '01/08/2026', 'modal_price': '2000'}, good]
        client = MagicMock()
        client.get.return_value = httpx.Response(200, json={'records': rows}, request=httpx.Request('GET', 'https://example.test'))
        with patch('mandi_adapter.httpx.Client') as factory:
            factory.return_value.__enter__.return_value = client
            result = adapter.get_current_mandi_price('Wheat', 'Punjab', 'Ludhiana')
        self.assertEqual(result['price'], 2200)
        self.assertEqual(result['record_date'], '2026-09-01')
        self.assertEqual(result['freshness_status'], 'stale')
        self.assertEqual(client.get.call_args.kwargs['params']['filters[district]'], 'Ludhiana')

    def test_missing_modal_price_never_becomes_2000(self):
        adapter = MandiPriceAdapter()
        adapter.enable_live_fetch = True
        adapter.api_key = 'test'
        adapter._get_cached_price = MagicMock(return_value={'source_type': 'historical_dataset'})
        client = MagicMock()
        client.get.return_value = httpx.Response(200, json={'records': [{'commodity': 'Wheat', 'arrival_date': '01/09/2026'}]}, request=httpx.Request('GET', 'https://example.test'))
        with patch('mandi_adapter.httpx.Client') as factory:
            factory.return_value.__enter__.return_value = client
            self.assertEqual(adapter.get_current_mandi_price('Wheat')['source_type'], 'historical_dataset')
        adapter._get_cached_price.assert_called_once_with('Wheat')
