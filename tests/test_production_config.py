"""Production fails closed without hiding an unavailable external provider."""

import pytest

from app import create_app
from config import validate_config
from ai.provider import create_ai_service, ProviderError


def production(**overrides):
    return {
        "APP_ENV": "production",
        "SECRET_KEY": "test-only-persistent-session-secret-32-chars",
        "SESSION_SECRET_CONFIGURED": True,
        "AI_PROVIDER": "anthropic",
        "ANTHROPIC_MODEL": "claude-sonnet-4-5",
        "ANTHROPIC_API_KEY": "",
        "APP_PUBLIC_URL": "https://english.example.test",
        "RATELIMIT_STORAGE_URI": "redis://127.0.0.1:16379/0",
        "MAIL_TRANSPORT": "disabled",
        "AUTO_INIT_DB": False,
        "TRUSTED_PROXY_COUNT": 0,
        **overrides,
    }


@pytest.mark.parametrize(
    "overrides",
    [
        {"SECRET_KEY": ""},
        {"SECRET_KEY": "short"},
        {"SESSION_SECRET_CONFIGURED": False},
        {"AI_PROVIDER": "mock"},
        {"AI_PROVIDER": "demo"},
        {"APP_PUBLIC_URL": "http://english.example.test"},
        {"APP_PUBLIC_URL": "https://localhost"},
        {"APP_PUBLIC_URL": "https://english.example.test/subpath"},
        {"APP_PUBLIC_URL": "https://user:pass@english.example.test"},
        {"RATELIMIT_STORAGE_URI": "memory://"},
        {"MAIL_TRANSPORT": "outbox"},
        {"MAIL_TRANSPORT": "memory"},
        {"AUTO_INIT_DB": True},
        {"DEBUG": True},
        {"TESTING": True},
        {"WTF_CSRF_ENABLED": False},
        {"RATELIMIT_ENABLED": False},
        {"TRUSTED_PROXY_COUNT": 2},
    ],
)
def test_invalid_production_configuration_is_rejected(overrides):
    with pytest.raises(ValueError):
        validate_config(production(**overrides))


def test_effective_config_sets_cookie_and_host_boundary():
    config = production(SESSION_COOKIE_SECURE=False, TRUSTED_HOSTS=["*"])
    validate_config(config)
    assert config["SESSION_COOKIE_SECURE"] is True
    assert config["SESSION_COOKIE_HTTPONLY"] is True
    assert config["SESSION_COOKIE_SAMESITE"] == "Strict"
    assert config["TRUSTED_HOSTS"] == ["english.example.test"]


def test_factory_overrides_cannot_promote_generated_session_secret():
    config = production()
    config.pop("SECRET_KEY")
    config.pop("SESSION_SECRET_CONFIGURED")
    with pytest.raises(ValueError, match="SECRET_KEY"):
        create_app(config)


def test_production_provider_without_key_is_unconfigured_and_never_demo():
    config = production()
    config.pop("AI_PROVIDER")
    ai = create_ai_service(config)
    assert ai.metadata()["mode"] == "unconfigured"
    assert ai.metadata()["provider"] == "anthropic"
    with pytest.raises(ProviderError) as caught:
        ai.provider.complete({})
    assert caught.value.status == 503
    assert caught.value.reason == "not_configured"


def test_direct_production_provider_rejects_demonstration():
    with pytest.raises(ValueError):
        create_ai_service(production(AI_PROVIDER="mock"))


def test_readiness_distinguishes_database_from_unconfigured_paid_services(client):
    assert client.get("/api/health").json["status"] == "ok"
    response = client.get("/api/ready")
    assert response.status_code == 503
    assert response.json["services"] == {
        "database": True,
        "aiConfigured": False,
        "emailConfigured": False,
    }


def test_provider_failure_logs_classification_without_private_content(
    app, client, monkeypatch, caplog
):
    import logging
    from tests.test_ui_contracts import ready_account

    ready_account(client)
    service = create_ai_service(
        {
            "AI_PROVIDER": "anthropic",
            "ANTHROPIC_MODEL": "claude-sonnet-4-5",
            "ANTHROPIC_API_KEY": "",
        }
    )
    app.extensions["english_ai"] = service
    with caplog.at_level(logging.WARNING):
        response = client.post("/api/lessons/greetings/explain", json={"attempt": 0})
    assert response.status_code == 503
    assert "reason=not_configured" in caplog.text
    caplog.clear()

    def fail(_request):
        raise RuntimeError("secret-provider-content-private@example.test")

    monkeypatch.setattr(service.provider, "complete", fail)
    with caplog.at_level(logging.WARNING):
        response = client.post("/api/lessons/greetings/explain", json={"attempt": 1})
    assert response.status_code == 503
    assert "code=RuntimeError" in caplog.text
    assert "secret-provider-content" not in caplog.text
    assert "secret-provider-content" not in str(response.json)
