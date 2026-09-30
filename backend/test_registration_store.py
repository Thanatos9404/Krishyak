from concurrent.futures import ThreadPoolExecutor
import csv
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from registration_store import append_registration


class RegistrationStoreContracts(unittest.TestCase):
    def test_concurrent_writers_keep_one_header_and_every_record(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'farmers.csv'
            def save(i):
                append_registration(path, ['id','name'], {'id':str(i),'name':'Test, Farmer\nहिंदी'})
            with ThreadPoolExecutor(max_workers=8) as executor:
                list(executor.map(save, range(20)))
            with path.open(encoding='utf-8',newline='') as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows),20)
            self.assertEqual({row['id'] for row in rows},{str(i) for i in range(20)})
            self.assertTrue(all(row['name']=='Test, Farmer\nहिंदी' for row in rows))

    def test_incompatible_or_partial_file_is_preserved(self):
        for original in (b'wrong\nvalue\n', b'id\npartial'):
            with tempfile.TemporaryDirectory() as folder:
                path = Path(folder) / 'farmers.csv'
                path.write_bytes(original)
                with self.assertRaises(ValueError):
                    append_registration(path,['id'],{'id':'next'})
                self.assertEqual(path.read_bytes(),original)

    def test_failed_flush_does_not_leave_a_successful_looking_record(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'farmers.csv'
            append_registration(path,['id'],{'id':'first'})
            before = path.read_bytes()
            with patch('registration_store.os.fsync',side_effect=OSError('disk unavailable')):
                with self.assertRaises(OSError):
                    append_registration(path,['id'],{'id':'second'})
            self.assertEqual(path.read_bytes(),before)
