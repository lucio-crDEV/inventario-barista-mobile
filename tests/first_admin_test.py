import contextlib
import io
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]

class FirstAdminTests(unittest.TestCase):
    def execute(self, path, passwords):
        with patch('sys.argv', ['first-admin.py', str(path)]), patch('builtins.input', side_effect=['admin-ensayo', 'Administrador ficticio']), patch('getpass.getpass', side_effect=passwords), contextlib.redirect_stdout(io.StringIO()):
            runpy.run_path(str(ROOT / 'scripts/first-admin.py'), run_name='__main__')

    def test_short_password_is_explained_without_subprocess_or_file(self):
        with tempfile.TemporaryDirectory() as tmp, patch('subprocess.run') as child:
            path = Path(tmp) / 'admin.sql'
            with self.assertRaisesRegex(SystemExit, 'al menos 8 caracteres'):
                self.execute(path, ['Clave-0'])
            child.assert_not_called()
            self.assertFalse(path.exists())

    def test_utf8_limit_is_explained(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(SystemExit, 'supera 72 bytes'):
                self.execute(Path(tmp) / 'admin.sql', ['ñ' * 40])

    def test_mismatch_is_explained(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(SystemExit, 'no coinciden'):
                self.execute(Path(tmp) / 'admin.sql', ['Personal-ensayo-2026', 'Otra-clave-2026'])

    def test_valid_password_generates_private_sql_without_plaintext(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'admin.sql'
            self.execute(path, ['Clave-08'] * 2)
            self.assertEqual(os.stat(path).st_mode & 0o777, 0o600)
            sql = path.read_text()
            self.assertNotIn('Clave-08', sql)
            self.assertIn('$2b$12$', sql)
            self.assertIn('NOT EXISTS(SELECT 1 FROM users)', sql)
            self.assertNotIn('BEGIN TRANSACTION', sql)
            self.assertNotIn('COMMIT;', sql)
            with self.assertRaisesRegex(SystemExit, 'ya existe'):
                self.execute(path, [])

if __name__ == '__main__': unittest.main()
