"""Real online backup/restore with data preservation and overwrite protection."""

import hashlib
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys

import pytest

from scripts.sqlite_backup import snapshot, verify


def test_backup_includes_committed_wal_and_restores_private_snapshot(tmp_path):
    source, backup, restored = [
        tmp_path / name for name in ["active.db", "backup.db", "restored.db"]
    ]
    with sqlite3.connect(source) as db:
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("CREATE TABLE users(id INTEGER PRIMARY KEY, name TEXT)")
        db.execute(
            "CREATE TABLE progress(user_id INTEGER REFERENCES users(id), score INTEGER)"
        )
        db.execute("INSERT INTO users VALUES(1, ?)", ("Learner preserved",))
        db.execute("INSERT INTO progress VALUES(1, 82)")
        db.commit()
        expected = {"users": 1, "progress": 1}
        assert snapshot(source, backup) == expected
        before = hashlib.sha256(backup.read_bytes()).hexdigest()
        assert snapshot(backup, restored) == expected
        assert hashlib.sha256(backup.read_bytes()).hexdigest() == before
        assert stat.S_IMODE(backup.stat().st_mode) == 0o600
        assert stat.S_IMODE(restored.stat().st_mode) == 0o600
        with sqlite3.connect(restored) as recovered:
            assert recovered.execute(
                "SELECT name, score FROM users JOIN progress ON id=user_id"
            ).fetchone() == ("Learner preserved", 82)
        db.execute("INSERT INTO users VALUES(2, ?)", ("Newer change",))
        db.commit()
        assert verify(source)["users"] == 2
        assert verify(backup)["users"] == 1


def test_restore_refuses_existing_database_and_symlinks(tmp_path):
    source, existing = tmp_path / "source.db", tmp_path / "existing.db"
    with sqlite3.connect(source) as db:
        db.execute("CREATE TABLE preserve(value TEXT)")
    existing.write_bytes(b"important-existing-data")
    with pytest.raises(FileExistsError):
        snapshot(source, existing)
    assert existing.read_bytes() == b"important-existing-data"
    link = tmp_path / "destination-link.db"
    link.symlink_to(existing)
    with pytest.raises(FileExistsError):
        snapshot(source, link)
    assert link.is_symlink()


def test_invalid_backup_is_not_published(tmp_path):
    source, destination = tmp_path / "invalid.db", tmp_path / "backup.db"
    source.write_bytes(b"not-a-database")
    with pytest.raises(sqlite3.DatabaseError):
        snapshot(source, destination)
    assert not destination.exists()
    assert not list(tmp_path.glob(".english-ai-snapshot-*"))


def test_cli_backup_restore_and_verify(tmp_path):
    source, backup, restored = [
        tmp_path / name for name in ["source.db", "backup.db", "restored.db"]
    ]
    with sqlite3.connect(source) as db:
        db.execute("CREATE TABLE data(value TEXT)")
        db.execute("INSERT INTO data VALUES(?)", ("preserved",))
    script = Path(__file__).parents[1] / "scripts/sqlite_backup.py"
    for args in [
        ("backup", source, backup),
        ("restore", backup, restored),
        ("verify", restored),
    ]:
        result = subprocess.run(
            [sys.executable, str(script), *map(str, args)],
            text=True,
            capture_output=True,
        )
        assert result.returncode == 0, result.stderr
    result = subprocess.run(
        [sys.executable, str(script), "restore", str(backup), str(restored)],
        text=True,
        capture_output=True,
    )
    assert result.returncode == 1
    assert verify(restored)["data"] == 1
