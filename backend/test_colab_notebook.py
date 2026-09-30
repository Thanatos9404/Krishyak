import ast
import contextlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

import build_colab_bundle


class ColabNotebookTests(unittest.TestCase):
    def test_generated_notebook_streams_output_and_preserves_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ('colab_train_candidate.py', 'finetune_disease_model.py',
                         'evaluate_disease_bundle.py', 'requirements-eval.txt', 'requirements-security.txt'):
                file = root / 'backend' / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('test fixture')
            for name in ('model.keras', 'manifest.json', 'class_indices.json', 'data_audit.json', 'evaluation.json'):
                file = root / 'backend/training_runs/publisher-efficientnet-v1' / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text('test fixture')
            with patch.object(build_colab_bundle, 'ROOT', root), contextlib.redirect_stdout(io.StringIO()):
                build_colab_bundle.main()
            notebook = json.loads((root / 'backend/training_runs/Krishyak_Authentic_GPU_Training_v2.ipynb').read_text())
            code = ''.join(notebook['cells'][1]['source'])
            tree = ast.parse(code)
            function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'run_logged')
            namespace = {'root':root, 'subprocess':subprocess}
            exec(compile(ast.Module(body=[function], type_ignores=[]), '<generated-notebook>', 'exec'), namespace)
            visible = io.StringIO()
            with contextlib.redirect_stdout(visible):
                namespace['run_logged']([sys.executable, '-c', 'print("training output")'])
                with self.assertRaises(subprocess.CalledProcessError) as failure:
                    namespace['run_logged']([sys.executable, '-c', 'import sys; print("failure detail",file=sys.stderr); sys.exit(3)'])
            self.assertEqual(failure.exception.returncode, 3)
            self.assertIn('training output', visible.getvalue())
            self.assertIn('failure detail', visible.getvalue())
            log = (root / 'training-session.log').read_text()
            self.assertIn('training output', log)
            self.assertIn('failure detail', log)
            recovery = next(node for node in tree.body if isinstance(node, ast.Try))
            recovery_code = compile(ast.Module(body=[recovery], type_ignores=[]), '<recovery>', 'exec')
            namespace.update(training_python=sys.executable, export_candidate=Mock())
            for error in (subprocess.CalledProcessError(7, ['trainer']), KeyboardInterrupt()):
                namespace['run_logged'] = Mock(side_effect=error)
                namespace['export_candidate'] = Mock()
                with self.assertRaises(type(error)) as raised:
                    exec(recovery_code, namespace)
                self.assertIs(raised.exception, error)
                namespace['export_candidate'].assert_called_once_with()
            namespace['export_candidate'] = Mock(side_effect=OSError('download unavailable'))
            with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(KeyboardInterrupt):
                exec(recovery_code, namespace)
            namespace['run_logged'] = Mock()
            namespace['export_candidate'] = Mock()
            exec(recovery_code, namespace)
            namespace['export_candidate'].assert_called_once_with()
