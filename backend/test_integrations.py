"""Provider schema, provenance and API contract regressions; no real submissions."""
import json
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch
import httpx
import gov_api_service as gov
from weather_alerts import WeatherAlertService


class OfficialDataTests(unittest.TestCase):
    def test_msp_frontend_backend_same_publication(self):
        root = Path(__file__).resolve().parents[1]
        self.assertEqual(gov.get_all_msp(), json.loads((root / 'frontend/src/data/msp_data.json').read_text(encoding='utf-8')))

    def test_msp_values_and_aliases(self):
        for crop, expected in [('Rice', 2441), ('Wheat', 2585), ('Cotton', 8267), ('Arhar', 8450), ('Chickpea', 5875)]:
            with self.subTest(crop=crop):
                record = gov.get_msp_for_crop(crop)
                self.assertEqual(record['msp'], expected)
                self.assertEqual(record['year'], '2026-27')
                self.assertTrue(record['source_url'].startswith('https://www.pib.gov.in/'))
        self.assertIsNone(gov.get_msp_for_crop(''))
        self.assertIsNone(gov.get_msp_for_crop('ice'))

    def test_msp_response_cannot_modify_shared_data(self):
        data = gov.get_all_msp()
        data['crops']['Rice']['msp'] = 0
        self.assertEqual(gov.get_msp_for_crop('Rice')['msp'], 2441)


class ProviderTests(unittest.IsolatedAsyncioTestCase):
    async def test_mandi_filters_and_invalid_records(self):
        gov.clear_cache()
        good = dict(state='Punjab', district='Ludhiana', commodity='Wheat', min_price='2000', modal_price='2200', max_price='2300')
        records = [good, {**good, 'commodity': 'Rice'}, {**good, 'modal_price': 'NaN'}, {**good, 'modal_price': '9000'}]
        client = AsyncMock()
        client.get.return_value = httpx.Response(200, json={'records': records, 'total': 4})
        with patch.object(gov, 'DATA_GOV_API_KEY', 'test'), patch.object(gov.httpx, 'AsyncClient') as factory:
            factory.return_value.__aenter__.return_value = client
            result = await gov.fetch_mandi_prices('Wheat', 'Punjab', 'Ludhiana', 10)
        params = client.get.call_args.kwargs['params']
        self.assertEqual(params['filters[commodity]'], 'Wheat')
        self.assertEqual(params['filters[state]'], 'Punjab')
        self.assertEqual(params['filters[district]'], 'Ludhiana')
        self.assertEqual(len(result['prices']), 1)
        self.assertEqual(result['prices'][0]['modal_price'], 2200)

    async def test_mandi_limit_and_cache_partition(self):
        for limit in (0, -1, 101):
            with self.assertRaises(ValueError):
                await gov.fetch_mandi_prices(limit=limit)
        gov.clear_cache()
        gov._set_cache('mandi_Wheat_None_None_10', {'prices': [1]})
        self.assertIsNone(gov._get_cache('mandi_Wheat_None_None_50', 'mandi'))
        self.assertEqual(gov.get_cache_stats()['entries'], 1)

    async def test_current_weather_missing_payload_not_fabricated(self):
        service = WeatherAlertService()
        client = AsyncMock()
        client.get.return_value = httpx.Response(200, json={'current': {}})
        with patch('weather_alerts.httpx.AsyncClient') as factory:
            factory.return_value.__aenter__.return_value = client
            self.assertIsNone(await service.get_current_weather(20, 78))

    async def test_weather_zero_and_wmo_codes(self):
        service = WeatherAlertService()
        current = dict(temperature_2m=0, apparent_temperature=-2, relative_humidity_2m=85, wind_speed_10m=0, weather_code=95, time='2026-09-06T12:00')
        client = AsyncMock()
        client.get.return_value = httpx.Response(200, json={'current': current})
        with patch('weather_alerts.httpx.AsyncClient') as factory:
            factory.return_value.__aenter__.return_value = client
            result = await service.get_current_weather(20, 78)
        self.assertEqual(result['temperature'], 0)
        self.assertEqual(result['wind_speed'], 0)
        self.assertEqual(result['condition'], 'Thunderstorm')
        for code, condition in [(0, 'Clear'), (3, 'Cloudy'), (45, 'Fog'), (51, 'Drizzle'), (61, 'Rain'), (71, 'Snow'), (100, 'Unknown')]:
            self.assertEqual(service._weather_condition(code), condition)


if __name__ == '__main__':
    unittest.main()
