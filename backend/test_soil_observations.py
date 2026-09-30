import tempfile
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from soil_data_cache import SoilDataCache
from sensor_adapter import SensorManager
from test_storage import reading

class SoilObservationContracts(unittest.TestCase):
    def setUp(self):
        self.folder=tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.cache=SoilDataCache(self.folder.name)

    def test_duplicate_poll_does_not_add_observations(self):
        item=reading()
        self.cache.save('farm',item)
        self.cache.save('farm',item)
        self.assertEqual(len(self.cache.get_history('farm')),1)

    def test_delayed_observation_does_not_replace_latest(self):
        recent=reading(nitrogen=20)
        old=reading(nitrogen=10,timestamp=recent.timestamp-timedelta(hours=2))
        self.cache.save('farm',recent)
        self.cache.save('farm',old)
        self.assertEqual(self.cache.get_latest('farm').nitrogen,20)
        self.assertEqual(len(self.cache.get_history('farm')),2)

    def test_invalid_or_wrong_device_reading_rejected(self):
        for item in (reading('other'),reading(nitrogen=float('nan'))):
            with self.assertRaises(ValueError):
                self.cache.save('farm',item)
        self.assertEqual(self.cache.list_cached_devices(),[])

    def test_manual_poll_preserves_staleness_and_history_count(self):
        manager=SensorManager()
        item=reading(timestamp=datetime.now()-timedelta(days=2))
        manager.set_manual_data('farm',item)
        self.cache.save('farm',item)
        with patch('main.sensor_manager',manager),patch('main.soil_cache',self.cache),TestClient(app) as client:
            for _ in range(2):
                response=client.get('/sensors/farm/data')
                self.assertEqual(response.status_code,200)
                self.assertTrue(response.json()['is_stale'])
            history=client.get('/sensors/farm/history').json()
            self.assertEqual(history['count'],1)
            for days in (0,-1,31):
                self.assertEqual(client.get(f'/sensors/farm/history?days={days}').status_code,422)

    def test_endpoint_returns_newer_cached_measurement_when_provider_lags(self):
        manager=SensorManager()
        recent=reading(nitrogen=42)
        older=reading(nitrogen=12,timestamp=recent.timestamp-timedelta(days=2))
        self.cache.save('farm',recent)
        manager.set_manual_data('farm',older)
        with patch('main.sensor_manager',manager),patch('main.soil_cache',self.cache),TestClient(app) as client:
            result=client.get('/sensors/farm/data').json()
            uncached=client.get('/sensors/farm/data?use_cache=false').json()
            self.assertEqual(uncached['data']['nitrogen'],12)
            self.assertTrue(uncached['is_stale'])
        self.assertEqual(result['data']['nitrogen'],42)
        self.assertEqual(result['source'],'cached')
        self.assertFalse(result['is_stale'])
