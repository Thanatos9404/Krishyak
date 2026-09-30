"""Persistence regressions use isolated temporary stores, never real farmer records."""
import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch
from sensor_adapter import SoilData
from soil_data_cache import SoilDataCache
import pest_data_store as pests


def reading(device='farm', nitrogen=10, timestamp=None):
    return SoilData(device, timestamp or datetime.now(), nitrogen, 20, 30, 6.5, 40, 25, source='manual')


class SoilStorageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.cache = SoilDataCache(self.directory.name)

    def test_complete_read_save_history_clear_cycle(self):
        self.assertIsNone(self.cache.get_latest('farm'))
        self.assertTrue(self.cache.is_stale('farm'))
        self.cache.save('farm', reading(timestamp=datetime.now(timezone.utc)))
        self.assertEqual(self.cache.get_latest('farm').nitrogen, 10)
        self.assertEqual(len(self.cache.get_history('farm')), 1)
        self.assertFalse(self.cache.is_stale('farm'))
        self.assertIsNotNone(self.cache.get_last_update_time('farm'))
        self.assertEqual(self.cache.list_cached_devices(), ['farm'])
        self.assertEqual(self.cache.get_cache_stats()['total_readings'], 1)
        self.cache.clear_device('farm')
        self.assertEqual(self.cache.list_cached_devices(), [])

    def test_distinct_device_ids_never_collide(self):
        self.cache.save('a/b', reading('a/b', 10))
        self.cache.save('a_b', reading('a_b', 20))
        self.assertEqual(self.cache.get_latest('a/b').nitrogen, 10)
        self.assertEqual(self.cache.get_latest('a_b').nitrogen, 20)
        self.assertEqual(len(list(Path(self.directory.name).glob('*.json'))), 2)

    def test_corrupt_store_not_silently_overwritten(self):
        path = self.cache._get_device_file('farm')
        path.write_text('{broken')
        with self.assertRaises(ValueError):
            self.cache.save('farm', reading())
        self.assertEqual(path.read_text(), '{broken')

    def test_disk_failure_keeps_previous_reading(self):
        self.cache.save('farm', reading(nitrogen=10))
        with patch('soil_data_cache.os.replace', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.cache.save('farm', reading(nitrogen=20))
        self.assertEqual(self.cache.get_latest('farm').nitrogen, 10)
        self.assertEqual(list(Path(self.directory.name).glob('*.tmp')), [])

    def test_old_observation_stays_stale_when_cached_now(self):
        self.cache.save('farm', reading(timestamp=datetime.now(timezone.utc) - timedelta(days=3)))
        self.assertTrue(self.cache.is_stale('farm'))
        self.assertEqual(self.cache.get_history('farm', days=1), [])

    def test_legacy_store_migrates_without_losing_identity(self):
        data = reading('a/b').to_dict()
        legacy = Path(self.directory.name) / 'a_b.json'
        legacy.write_text(json.dumps({'device_id': 'a/b', 'readings': [data], 'latest': data}))
        self.assertIsNone(self.cache.get_latest('a_b'))
        self.assertEqual(self.cache.get_latest('a/b').nitrogen, 10)
        self.cache.save('a/b', reading('a/b', 20))
        self.assertEqual(self.cache.list_cached_devices(), ['a/b'])
        self.cache.clear_device('a/b')
        self.assertFalse(legacy.exists())

    def test_deserialization_does_not_mutate_input(self):
        data = reading().to_dict()
        SoilData.from_dict(data)
        self.assertIsInstance(data['timestamp'], str)


class PestStorageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        root = Path(self.directory.name)
        self.patch = patch.multiple(pests, REPORTS_FILE=root / 'reports.json', HISTORY_FILE=root / 'history.json')
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.store = pests.PestDataStore()

    def test_report_lifecycle_and_filters(self):
        report = pests.FarmerPestReport('', 'test-user', 'aphid', 'Aphid', 'Wheat', 'medium', 'test only', {'lat': 0, 'lon': 0}, 'Ludhiana', 'Punjab')
        identifier = self.store.save_farmer_report(report)
        self.assertEqual(self.store.get_report_by_id(identifier).crop, 'Wheat')
        self.assertEqual(len(self.store.get_reports_by_region('Punjab', 'Ludhiana')), 1)
        self.assertEqual(self.store.get_reports_by_region('Kerala'), [])
        self.assertEqual(len(self.store.get_reports_by_crop('wheat')), 1)
        self.assertEqual(len(self.store.get_recent_reports()), 1)
        self.assertEqual(self.store.get_report_statistics()['total_reports'], 1)
        self.assertTrue(self.store.verify_report(identifier, True, 'test review'))
        self.assertTrue(self.store.get_report_by_id(identifier).verified)
        self.assertFalse(self.store.verify_report('missing', True))
        self.assertIsNone(self.store.get_report_by_id('missing'))

    def test_corrupt_reports_not_replaced(self):
        pests.REPORTS_FILE.write_text('{broken')
        with self.assertRaises(ValueError):
            self.store.get_recent_reports()
        self.assertEqual(pests.REPORTS_FILE.read_text(), '{broken')


if __name__ == '__main__':
    unittest.main()
