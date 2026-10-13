"""Audit boundary: synthetic data, temporary SQLite and no network or dotenv."""

from datetime import timedelta
from functools import partial
from pathlib import Path
import socket

from flask import Flask
import pytest
from sqlalchemy import event

import app as application_module
from extensions import db


class AuditClient:
    """Exercise signed CSRF as well as the real HTTP handlers and database."""

    def __init__(self, application):
        self.client = application.test_client()

    def open(self, path, method="GET", *, csrf=True, headers=None, **kwargs):
        headers = dict(headers or {})
        if csrf and method not in {"GET", "HEAD", "OPTIONS"}:
            token = self.client.get("/api/csrf").get_json()["csrfToken"]
            headers.setdefault("X-CSRFToken", token)
        return self.client.open(path, method=method, headers=headers, **kwargs)

    def get(self, path, **kwargs):
        return self.open(path, "GET", **kwargs)

    def post(self, path, **kwargs):
        return self.open(path, "POST", **kwargs)

    def put(self, path, **kwargs):
        return self.open(path, "PUT", **kwargs)

    def patch(self, path, **kwargs):
        return self.open(path, "PATCH", **kwargs)

    def delete(self, path, **kwargs):
        return self.open(path, "DELETE", **kwargs)


@pytest.fixture
def audit_app(tmp_path, monkeypatch):
    network_attempts = []
    allowed_addresses = set()
    original_connect = socket.socket.connect

    def deny_network(_socket, address):
        if address in allowed_addresses:
            return original_connect(_socket, address)
        network_attempts.append(address)
        raise AssertionError("Network access is forbidden in the isolated SQL audit.")

    monkeypatch.setattr(socket.socket, "connect", deny_network)
    instance = tmp_path / "audit-instance"
    settings = {
        "TESTING": True,
        "APP_ENV": "testing",
        "SECRET_KEY": "synthetic-audit-session-key-never-for-deployment",
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{instance / 'synthetic.db'}",
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "AUTO_INIT_DB": True,
        "SESSION_COOKIE_NAME": "audit_synthetic_session",
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Strict",
        "SESSION_COOKIE_SECURE": False,
        "PERMANENT_SESSION_LIFETIME": timedelta(hours=1),
        "MAX_CONTENT_LENGTH": 16 * 1024,
        "WTF_CSRF_ENABLED": True,
        "WTF_CSRF_HEADERS": ["X-CSRFToken"],
        "WTF_CSRF_TIME_LIMIT": 3600,
        "RATELIMIT_ENABLED": False,
        "RATELIMIT_STORAGE_URI": "memory://",
        "AI_PROVIDER": "mock",
        "ANTHROPIC_API_KEY": "",
        "AI_MAX_HISTORY_MESSAGES": 12,
        "CONVERSATION_RETENTION_DAYS": 90,
        "MAIL_TRANSPORT": "disabled",
        "MAIL_OUTBOX_DIR": str(instance / "disabled-outbox"),
        "APP_PUBLIC_URL": "http://localhost.invalid",
        "PASSWORD_RESET_TTL_MINUTES": 15,
        "TIME_ZONE": "America/Sao_Paulo",
    }
    # Do not load .env, inherited database URLs, API credentials or SMTP settings.
    monkeypatch.setattr(application_module, "load_config", lambda: settings.copy())
    monkeypatch.setattr(
        application_module, "Flask", partial(Flask, instance_path=str(instance))
    )
    application = application_module.create_app()
    # A dedicated Redis test may opt into one ephemeral loopback address only.
    # External providers and every other address remain forbidden.
    application.extensions["audit_allowed_addresses"] = allowed_addresses
    with application.app_context():
        assert db.engine.dialect.name == "sqlite"
        assert Path(db.engine.url.database).resolve().is_relative_to(tmp_path.resolve())
        assert application.extensions["english_ai"].metadata()["mode"] == "demo"
        assert application.config["MAIL_TRANSPORT"] == "disabled"
    yield application
    with application.app_context():
        db.session.remove()
        db.engine.dispose()
    assert not network_attempts, "An audit test attempted network access."


@pytest.fixture
def audit_client(audit_app):
    return AuditClient(audit_app)


@pytest.fixture
def audit_accounts(audit_app):
    accounts = []
    for letter in ("a", "b"):
        client = AuditClient(audit_app)
        response = client.post(
            "/api/auth/register",
            json={
                "name": f"Synthetic Audit {letter.upper()}",
                "email": f"audit-{letter}@example.test",
                "password": "SyntheticAudit2026",
                "passwordConfirmation": "SyntheticAudit2026",
                "acceptedTerms": True,
            },
        )
        assert response.status_code == 201
        account = response.get_json()
        response = client.put(
            "/api/me/profile",
            json={
                "goal": "basics",
                "perceivedLevel": "beginner",
                "priorExperience": "none",
                "conversationInterest": True,
                "professionalInterest": False,
                "interestAreas": ["education"],
            },
        )
        assert response.status_code == 200
        assert client.post("/api/placement/skip").status_code == 200
        accounts.append(
            {
                "client": client,
                "user_id": account["user"]["id"],
                "email": account["user"]["email"],
            }
        )
    return tuple(accounts)


@pytest.fixture
def sql_capture(audit_app):
    """Inspect bindings in memory; never publish parameter values or SQL dumps."""
    records = []

    def capture(_connection, _cursor, statement, parameters, _context, _many):
        records.append((statement, parameters))

    with audit_app.app_context():
        engine = db.engine
    event.listen(engine, "before_cursor_execute", capture)
    yield records
    event.remove(engine, "before_cursor_execute", capture)


@pytest.fixture
def audit_client_factory(audit_app):
    return lambda: AuditClient(audit_app)
