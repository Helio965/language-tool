"""Private creation also applies outside automatic initialization; URIs stay native."""

import os
import stat

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError


def test_direct_connection_creates_private_file_and_directory(audit_app, tmp_path):
    path = tmp_path / "direct-connection" / "synthetic.db"
    engine = create_engine(f"sqlite:///{path}")
    previous = os.umask(0o022)
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar() == 1
    finally:
        os.umask(previous)
        engine.dispose()
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert stat.S_IMODE(path.parent.stat().st_mode) == 0o700


def test_memory_uri_does_not_create_a_literal_file(audit_app, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    engine = create_engine(
        "sqlite:///file:audit-memory?mode=memory&cache=shared&uri=true"
    )
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar() == 1
    finally:
        engine.dispose()
    assert not (tmp_path / "file:audit-memory").exists()
    assert not (tmp_path / "audit-memory").exists()


def test_read_only_uri_does_not_precreate_missing_data(audit_app, tmp_path):
    path = tmp_path / "missing-read-only.db"
    engine = create_engine(f"sqlite:///file:{path}?mode=ro&uri=true")
    try:
        with pytest.raises(OperationalError):
            with engine.connect():
                pass
    finally:
        engine.dispose()
    assert not path.exists()


def test_plain_memory_connection_is_unchanged(audit_app, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    engine = create_engine("sqlite:///:memory:")
    try:
        with engine.connect() as connection:
            assert connection.execute(text("SELECT 1")).scalar() == 1
    finally:
        engine.dispose()
    assert not (tmp_path / ":memory:").exists()
