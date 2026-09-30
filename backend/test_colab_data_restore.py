import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from colab_train_candidate import restore_archive, destination


class ColabRestoreContracts(unittest.TestCase):
    def archive(self, payload):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            entry = tarfile.TarInfo('publisher/test/Apple leaf/photo.jpg')
            entry.size = len(payload)
            archive.addfile(entry, io.BytesIO(payload))
        stream.seek(0)
        return stream

    def test_only_exact_publisher_bytes_are_restored(self):
        payload = b'publisher image bytes'
        row = {'source': 'PlantDoc', 'sha256': hashlib.sha256(payload).hexdigest(),
               'path': 'datasets/authentic/PlantDoc-export/test/Apple/image.jpg'}
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            restore_archive(self.archive(payload), root, [row], 'PlantDoc')
            self.assertEqual((root / row['path']).read_bytes(), payload)
            with self.assertRaisesRegex(ValueError, 'missing 1'):
                restore_archive(self.archive(b'changed image'), root, [row], 'PlantDoc')

    def test_manifest_cannot_escape_dataset_directory(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                destination(Path(folder), {'path': 'datasets/authentic/../../../outside.txt'})
