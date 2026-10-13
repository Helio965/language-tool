"""Final production overrides use synthetic configuration and no live services."""

import socket

import pytest

import app as application_module
import config as configuration
from extensions import db


@pytest.fixture(autouse=True)
def deny_live_network(monkeypatch):
    def forbidden_connection(_connection, _address):
        pytest.fail("Live network is forbidden in configuration regressions.")

    monkeypatch.setattr(socket.socket, "connect", forbidden_connection)


def production_settings(**overrides):
    return {
        "APP_ENV": "production",
        "SECRET_KEY": "synthetic-stable-session-key-more-than-32-characters",
        "DEBUG": False,
        "SESSION_COOKIE_SECURE": True,
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SAMESITE": "Strict",
        "WTF_CSRF_ENABLED": True,
        "RATELIMIT_ENABLED": True,
        "RATELIMIT_STORAGE_URI": "rediss://synthetic-quota.example.invalid:6379/0",
        "AI_PROVIDER": "anthropic",
        "MAIL_TRANSPORT": "disabled",
        **overrides,
    }


@pytest.mark.parametrize(
    "name,value",
    [
        ("AI_MAX_OUTPUT_TOKENS", 100000),
        ("AI_MAX_OUTPUT_TOKENS", 255),
        ("AI_MAX_CONTEXT_CHARS", 12001),
        ("AI_MAX_CONTEXT_CHARS", 2047),
        ("AI_TIMEOUT_MS", 0),
        ("AI_TIMEOUT_MS", 120001),
        ("AI_MINUTE_REQUEST_LIMIT", 1000000),
        ("AI_MINUTE_REQUEST_LIMIT", 0),
        ("AI_DAILY_REQUEST_LIMIT", 2001),
        ("AI_DAILY_REQUEST_LIMIT", 9),
        ("AI_GLOBAL_DAILY_REQUEST_LIMIT", 100001),
        ("AI_GLOBAL_DAILY_REQUEST_LIMIT", -1),
        ("AI_MAX_HISTORY_MESSAGES", 51),
        ("AI_MAX_HISTORY_MESSAGES", 1),
    ],
)
def test_effective_production_rejects_unbounded_ai_cost_controls(name, value):
    with pytest.raises(ValueError, match=name):
        configuration.validate_effective_config(production_settings(**{name: value}))


@pytest.mark.parametrize("value", [True, False, "1024", 1024.0, None])
def test_effective_production_rejects_noninteger_ai_budget(value):
    with pytest.raises(ValueError, match="AI_MAX_OUTPUT_TOKENS"):
        configuration.validate_effective_config(
            production_settings(AI_MAX_OUTPUT_TOKENS=value)
        )


def test_valid_production_cost_controls_do_not_connect_to_storage():
    configuration.validate_effective_config(
        production_settings(
            AI_TIMEOUT_MS=120000,
            AI_MAX_OUTPUT_TOKENS=2048,
            AI_MAX_CONTEXT_CHARS=12000,
            AI_MINUTE_REQUEST_LIMIT=120,
            AI_DAILY_REQUEST_LIMIT=2000,
            AI_GLOBAL_DAILY_REQUEST_LIMIT=100000,
            AI_MAX_HISTORY_MESSAGES=50,
        )
    )


def test_factory_rejects_cost_override_before_initializing_services(
    audit_app, monkeypatch
):
    def forbidden_initialization(_application):
        pytest.fail("Invalid production settings reached database initialization.")

    monkeypatch.setattr(db, "init_app", forbidden_initialization)
    settings = {
        **audit_app.config,
        **production_settings(AI_MAX_OUTPUT_TOKENS=100000),
    }
    with pytest.raises(ValueError, match="AI_MAX_OUTPUT_TOKENS"):
        application_module.create_app(settings)


@pytest.fixture
def synthetic_development_config(audit_app, monkeypatch):
    # Do not read .env or inherited service credentials when testing promotion.
    monkeypatch.setattr(configuration.os, "environ", {})
    monkeypatch.setattr(configuration, "load_dotenv", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(application_module, "load_config", configuration.load_config)
    return audit_app


def promoted_settings(tmp_path, **overrides):
    return {
        "APP_ENV": "production",
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'synthetic-promoted.db'}",
        "AUTO_INIT_DB": False,
        "SESSION_COOKIE_SECURE": True,
        "MAIL_TRANSPORT": "disabled",
        "APP_PUBLIC_URL": "https://synthetic-promotion.example.invalid",
        **overrides,
    }


def test_factory_rejects_promoting_generated_session_key_to_production(
    synthetic_development_config, tmp_path
):
    with pytest.raises(ValueError, match="SECRET_KEY configurada explicitamente"):
        application_module.create_app(promoted_settings(tmp_path))


def test_generated_development_key_remains_compatible_with_signed_sessions(
    synthetic_development_config, tmp_path
):
    application = application_module.create_app(
        {
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'synthetic-signer.db'}",
            "AUTO_INIT_DB": False,
            "MAIL_TRANSPORT": "disabled",
        }
    )
    client = application.test_client()
    response = client.get("/api/csrf")
    assert response.status_code == 200
    assert response.get_json()["csrfToken"]
    assert client.get_cookie(application.config["SESSION_COOKIE_NAME"])
    with application.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.mark.parametrize(
    "stable_key",
    [
        "synthetic-explicit-session-key-more-than-32-characters",
        b"synthetic-explicit-byte-session-key-more-than-32-characters",
    ],
)
def test_factory_accepts_explicit_stable_key_when_promoting_to_production(
    synthetic_development_config, tmp_path, stable_key
):
    application = application_module.create_app(
        promoted_settings(tmp_path, SECRET_KEY=stable_key)
    )
    assert application.config["APP_ENV"] == "production"
    assert application.secret_key == stable_key
    with application.app_context():
        db.session.remove()
        db.engine.dispose()
