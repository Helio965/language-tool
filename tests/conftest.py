"""Isolated application/database fixtures; no external AI or SMTP calls."""

import pytest

from app import create_app
from extensions import db


@pytest.fixture
def app(tmp_path):
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-session-secret-with-at-least-32-characters",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
            "AUTO_INIT_DB": True,
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": False,
            "AI_PROVIDER": "mock",
            "MAIL_TRANSPORT": "outbox",
            "MAIL_OUTBOX_DIR": str(tmp_path / "outbox"),
            "APP_PUBLIC_URL": "http://localhost:5000",
        }
    )
    yield application
    with application.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def client(app):
    return app.test_client()
