"""An offline import must claim a new private destination without overwriting races."""

from hashlib import sha256
import sqlite3
import stat

import pytest

from models.migration import import_legacy


def make_synthetic_source(path):
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE source_marker(value TEXT)")
        connection.execute("INSERT INTO source_marker VALUES(?)", ("synthetic-source",))


def test_import_refuses_destination_created_after_initial_check(tmp_path, monkeypatch):
    source, destination = tmp_path / "source.db", tmp_path / "destination.db"
    make_synthetic_source(source)
    before = sha256(source.read_bytes()).digest()
    actual_connect = sqlite3.connect

    def concurrent_destination(database, *args, **kwargs):
        if str(database).endswith("?mode=ro"):
            with actual_connect(destination) as connection:
                connection.execute("CREATE TABLE other_import_marker(value TEXT)")
                connection.execute(
                    "INSERT INTO other_import_marker VALUES(?)",
                    ("other-synthetic-import",),
                )
        return actual_connect(database, *args, **kwargs)

    monkeypatch.setattr("models.migration.sqlite3.connect", concurrent_destination)
    with pytest.raises(FileExistsError):
        import_legacy(source, destination)
    with actual_connect(destination) as connection:
        assert (
            connection.execute("SELECT value FROM other_import_marker").fetchone()[0]
            == "other-synthetic-import"
        )
        assert (
            connection.execute(
                "SELECT name FROM sqlite_master WHERE name='source_marker'"
            ).fetchone()
            is None
        )
    assert sha256(source.read_bytes()).digest() == before


def test_source_validation_failure_does_not_delete_an_unclaimed_destination(
    tmp_path, monkeypatch
):
    source, destination = tmp_path / "invalid-source.db", tmp_path / "other-import.db"
    source.write_bytes(b"synthetic invalid database")
    actual_connect = sqlite3.connect

    def concurrent_destination(database, *args, **kwargs):
        if str(database).endswith("?mode=ro"):
            destination.write_bytes(b"synthetic unrelated destination")
        return actual_connect(database, *args, **kwargs)

    monkeypatch.setattr("models.migration.sqlite3.connect", concurrent_destination)
    with pytest.raises(sqlite3.DatabaseError):
        import_legacy(source, destination)
    assert destination.read_bytes() == b"synthetic unrelated destination"


def test_imported_data_is_private_before_the_first_backup_connection(
    tmp_path, monkeypatch
):
    source, destination = (
        tmp_path / "source.db",
        tmp_path / "new-private-directory" / "copy.db",
    )
    make_synthetic_source(source)
    before = sha256(source.read_bytes()).digest()
    actual_connect = sqlite3.connect
    observed = []

    def check_private_copy(database, *args, **kwargs):
        if database == destination:
            observed.append(stat.S_IMODE(destination.stat().st_mode))
            assert observed[-1] == 0o600
            assert stat.S_IMODE(destination.parent.stat().st_mode) == 0o700
        return actual_connect(database, *args, **kwargs)

    monkeypatch.setattr("models.migration.sqlite3.connect", check_private_copy)
    assert import_legacy(source, destination) == destination
    assert observed == [0o600]
    assert sha256(source.read_bytes()).digest() == before
    with actual_connect(destination) as connection:
        assert (
            connection.execute("SELECT value FROM source_marker").fetchone()[0]
            == "synthetic-source"
        )
