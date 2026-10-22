import importlib.util
from pathlib import Path
import sqlite3
import unittest

spec = importlib.util.spec_from_file_location("order_restore", Path(__file__).resolve().parents[1] / "scripts/operations/order-restore.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RestoreOrderTest(unittest.TestCase):
    def test_parent_exists_before_data_and_trigger_runs_only_after_import(self):
        sql = """PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE children(id INTEGER, user_id INTEGER REFERENCES users(id), note TEXT);
INSERT INTO children VALUES(1,2,'Nota; CREATE TABLE falsa; --texto');
CREATE TABLE users(id INTEGER PRIMARY KEY);
INSERT INTO users VALUES(2);
CREATE TRIGGER keep_user BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT,'keep; user'); END;
"""
        db = sqlite3.connect(":memory:")
        db.execute("PRAGMA foreign_keys=ON")
        db.executescript("BEGIN;" + module.ordered_dump(sql) + "COMMIT;")
        self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
        self.assertEqual(db.execute("SELECT note FROM children").fetchone()[0], "Nota; CREATE TABLE falsa; --texto")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("DELETE FROM users")
        db.close()

    def test_unknown_sql_is_rejected_without_execution(self):
        with self.assertRaises(ValueError):
            module.ordered_dump("ATTACH DATABASE '/tmp/forbidden' AS other;")

    def test_incomplete_dump_is_rejected(self):
        with self.assertRaises(ValueError):
            module.ordered_dump("CREATE TABLE t(id INTEGER);\nINSERT INTO t VALUES('")
