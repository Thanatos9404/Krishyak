import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from sensor_adapter import SoilData, FasalAdapter, CropInAdapter, ConnectionStatus

class SensorContracts(unittest.IsolatedAsyncioTestCase):
    async def test_provider_missing_invalid_and_zero_values(self):
        for cls, payload, nutrient in (
            (FasalAdapter, {'timestamp': datetime.now(timezone.utc).isoformat(), 'nitrogen': 0, 'phosphorus': 0, 'potassium': 0, 'ph': 0, 'moisture': 0, 'soil_temp': 0}, 'nitrogen'),
            (CropInAdapter, {'recorded_at': datetime.now(timezone.utc).isoformat(), 'n_value': 0, 'p_value': 0, 'k_value': 0, 'ph_level': 0, 'soil_moisture': 0, 'soil_temperature': 0}, 'n_value'),
        ):
            adapter = cls()
            adapter.api_key = 'test'
            response = MagicMock(status_code=200)
            client = AsyncMock()
            client.get.return_value = response
            with patch('sensor_adapter.httpx.AsyncClient') as factory:
                factory.return_value.__aenter__.return_value = client
                response.json.return_value = payload.copy()
                self.assertEqual((await adapter.get_soil_data('test')).nitrogen, 0)
                for invalid in (None, float('nan'), True, -1, '0'):
                    response.json.return_value = {**payload, nutrient: invalid}
                    self.assertIsNone(await adapter.get_soil_data('test'))
                response.json.return_value = {k: v for k, v in payload.items() if k != nutrient}
                self.assertIsNone(await adapter.get_soil_data('test'))

    async def test_cropin_status_requires_a_fresh_actual_reading(self):
        adapter = CropInAdapter()
        adapter.api_key = ''
        self.assertEqual(await adapter.get_connection_status('test'), ConnectionStatus.NOT_CONFIGURED)
        adapter.api_key = 'test'
        adapter.get_soil_data = AsyncMock(return_value=None)
        self.assertEqual(await adapter.get_connection_status('test'), ConnectionStatus.ERROR)
        reading = SoilData('test', datetime.now(timezone.utc), 0, 0, 0, 7, 0, 0)
        adapter.get_soil_data.return_value = reading
        self.assertEqual(await adapter.get_connection_status('test'), ConnectionStatus.CONNECTED)
        reading.timestamp = datetime(2020, 1, 1, tzinfo=timezone.utc)
        self.assertEqual(await adapter.get_connection_status('test'), ConnectionStatus.STALE)

if __name__ == '__main__':
    unittest.main()
