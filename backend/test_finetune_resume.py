import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from finetune_disease_model import resume_state


class ResumeIdentityTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.parent = Path(self.directory.name) / 'parent'
        self.output = Path(self.directory.name) / 'candidate'
        for directory in (self.parent, self.output):
            directory.mkdir()
            for name in ('manifest.json', 'class_indices.json', 'data_audit.json'):
                (directory / name).write_text('{}')
            (directory / 'model.keras').write_bytes(b'fixture model')
        (self.output / 'finetuning.json').write_text(json.dumps({
            'parent_model_sha256': hashlib.sha256(b'fixture model').hexdigest()}))
        (self.output / 'training.csv').write_text('epoch,val_loss\n0,0.8\n1,0.7\n')

    def test_matching_experiment_resumes_after_completed_epochs(self):
        self.assertEqual(resume_state(self.parent, self.output), (2, 0.7))

    def test_rejects_changed_parent_without_mutating_candidate(self):
        before = {p.name: p.read_bytes() for p in self.output.iterdir()}
        (self.parent / 'model.keras').write_bytes(b'different model')
        with self.assertRaisesRegex(ValueError, 'parent model differs'):
            resume_state(self.parent, self.output)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.output.iterdir()})

    def test_rejects_changed_manifest_labels_or_provenance(self):
        for name in ('manifest.json', 'class_indices.json', 'data_audit.json'):
            with self.subTest(name=name):
                (self.parent / name).write_text('{"changed":true}')
                with self.assertRaisesRegex(ValueError, 'metadata differs'):
                    resume_state(self.parent, self.output)
                (self.parent / name).write_text('{}')

    def test_rejects_incomplete_or_corrupt_epoch_history(self):
        for rows in ('', '0,nan\n', '0,inf\n', '0,-1\n', '1,0.5\n', '0,0.8\n0,0.7\n', '0,0.8\n2,0.7\n'):
            with self.subTest(rows=rows):
                (self.output / 'training.csv').write_text('epoch,val_loss\n' + rows)
                with self.assertRaises(ValueError):
                    resume_state(self.parent, self.output)

    def test_requires_checkpoint(self):
        (self.output / 'model.keras').unlink()
        with self.assertRaisesRegex(ValueError, 'checkpoint is missing'):
            resume_state(self.parent, self.output)
