"""Real zoneinfo package fallback without system zones, dotenv, DB or network."""

from pathlib import Path
import os
import subprocess
import sys


def test_progress_uses_packaged_iana_data_without_system_timezone_database(audit_app):
    # A new interpreter avoids reusing zones cached by other tests. Supply only
    # the settings needed here instead of inheriting application credentials.
    repository = Path(__file__).resolve().parents[2]
    script = """
import socket
from datetime import datetime, timezone
from zoneinfo import TZPATH

def deny_network(*args, **kwargs):
    raise AssertionError('Network is forbidden in the timezone fallback regression.')

socket.socket.connect = deny_network
socket.create_connection = deny_network
from services.progresso import local_date

assert TZPATH == (), 'System time-zone data must be unavailable for this regression.'
assert local_date(datetime(2026, 3, 3, 1, tzinfo=timezone.utc), 'America/Sao_Paulo') == '2026-03-02'
assert local_date(datetime(2026, 3, 3, 4, tzinfo=timezone.utc), 'America/Sao_Paulo') == '2026-03-03'
print('Packaged IANA timezone fallback passed.')
"""
    environment = {
        "PYTHONTZPATH": "",
        "PYTHONIOENCODING": "utf-8",
        "PYTHONPATH": str(repository),
    }
    # Windows may require SystemRoot to load side-by-side runtime assemblies;
    # no application settings, API keys or inherited database URLs are copied.
    if sys.platform == "win32" and "SystemRoot" in os.environ:
        environment["SystemRoot"] = os.environ["SystemRoot"]
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=repository,
        env=environment,
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "Packaged IANA timezone fallback passed."
