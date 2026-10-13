"""Quota regressions: temporary synthetic SQLite, fake LLM and denied egress."""

import json
import time

import pytest

from app import create_app
from ai.provider import LLMAIService, ProviderError
from content import catalog
from extensions import db, limiter
from limits import parse
from models import UserVocabulary


class ConfiguredQuotaProvider:
    name = "anthropic"
    model = "synthetic-quota-model"
    configured = True

    def __init__(self):
        self.calls = []

    def complete(self, request):
        self.calls.append(request)
        values = {
            "reply": "Hello! How are you?",
            "translation": "",
            "facts": [],
            "issues": [],
            "feedback": "A clear sentence.",
            "explanation": "Practice a short greeting.",
            "en": "Hello, Ana.",
            "pt": "Olá, Ana.",
            "highlight": "Hello",
        }
        return json.dumps(
            {key: values[key] for key in request["jsonSchema"]["required"]}
        )


@pytest.fixture
def quota_factory(audit_app, tmp_path):
    """Reuse the audit fixture's dotenv/network barrier, not its disabled limiter."""
    applications = []

    def build(**overrides):
        settings = dict(audit_app.config)
        settings.update(
            SQLALCHEMY_DATABASE_URI=f"sqlite:///{tmp_path / f'quota-{len(applications)}.db'}",
            RATELIMIT_ENABLED=True,
            RATELIMIT_STORAGE_URI="memory://",
            RATELIMIT_HEADERS_ENABLED=True,
            AI_PROVIDER="anthropic",
            ANTHROPIC_API_KEY="",
            ANTHROPIC_MODEL="synthetic-quota-model",
            AI_MINUTE_REQUEST_LIMIT=10,
            AI_DAILY_REQUEST_LIMIT=100,
            AI_GLOBAL_DAILY_REQUEST_LIMIT=1000,
            MAIL_TRANSPORT="disabled",
        )
        settings.update(overrides)
        application = create_app(settings)
        applications.append(application)
        provider = ConfiguredQuotaProvider()
        if settings["AI_PROVIDER"] == "anthropic":
            application.extensions["english_ai"] = LLMAIService(provider)
        return application, provider

    yield build
    for application in applications:
        with application.app_context():
            db.session.remove()
            db.engine.dispose()


def post(client, path, data=None, **kwargs):
    headers = dict(kwargs.pop("headers", {}))
    token = client.get("/api/csrf").get_json()["csrfToken"]
    headers["X-CSRFToken"] = token
    return client.post(path, json=data or {}, headers=headers, **kwargs)


def register(application, label="a"):
    client = application.test_client()
    result = post(
        client,
        "/api/auth/register",
        {
            "name": "Synthetic Quota " + label,
            "email": label + "@example.test",
            "password": "SyntheticQuota2026",
            "passwordConfirmation": "SyntheticQuota2026",
            "acceptedTerms": True,
        },
    )
    assert result.status_code == 201
    assert post(client, "/api/placement/skip").status_code == 200
    return client, result.get_json()["user"]["id"]


def test_authored_openings_do_not_spend_external_budget(quota_factory):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    client, _ = register(application)
    for _ in range(12):
        result = post(client, "/api/conversations", {"topicId": "lesson:greetings"})
        assert result.status_code == 201
        assert result.get_json()["messages"][0]["ai"]["mode"] == "authored"
    assert provider.calls == []
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 201
    )
    assert len(provider.calls) == 1


def test_demo_activity_does_not_use_paid_minute_limit(quota_factory):
    application, provider = quota_factory(AI_PROVIDER="demo")
    client, _ = register(application)
    outcomes = [
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        for _ in range(12)
    ]
    assert outcomes == [201] * 12
    assert provider.calls == []


@pytest.mark.parametrize("authenticated", [False, True])
def test_rejected_requests_do_not_exhaust_global_budget(quota_factory, authenticated):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=3)
    client = register(application)[0] if authenticated else application.test_client()
    outcomes = [
        post(
            client, "/api/conversations", {"topicId": "synthetic-missing-topic"}
        ).status_code
        for _ in range(4)
    ]
    assert outcomes == [404 if authenticated else 401] * 4
    if not authenticated:
        client, _ = register(application)
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 201
    )
    assert len(provider.calls) == 1


def test_minute_quota_is_shared_by_routes_and_sessions(quota_factory):
    application, provider = quota_factory(AI_MINUTE_REQUEST_LIMIT=3)
    client, _ = register(application)
    conversation = post(client, "/api/conversations", {"topicId": "introductions"})
    assert conversation.status_code == 201
    assert post(client, "/api/lessons/greetings/explain").status_code == 200
    another_session = application.test_client()
    cookie = client.get_cookie(application.config["SESSION_COOKIE_NAME"])
    another_session.set_cookie(cookie.key, cookie.value)
    assert post(another_session, "/api/lessons/greetings/example").status_code == 200
    rejected = post(
        another_session,
        f"/api/conversations/{conversation.get_json()['id']}/messages",
        {"text": "I enjoy learning English."},
        environ_overrides={"REMOTE_ADDR": "192.0.2.25"},
    )
    assert rejected.status_code == 429
    assert rejected.get_json()["error"]["code"] == "RATE_LIMITED"
    assert rejected.headers["X-RateLimit-Limit"] == "3"
    assert int(rejected.headers["Retry-After"]) >= 1
    assert len(provider.calls) == 3


def test_user_daily_quota_survives_a_minute_window(quota_factory):
    application, provider = quota_factory(
        AI_MINUTE_REQUEST_LIMIT=2, AI_DAILY_REQUEST_LIMIT=3
    )
    client, owner = register(application)
    for _ in range(2):
        assert post(client, "/api/lessons/greetings/explain").status_code == 200
    assert post(client, "/api/lessons/greetings/example").status_code == 429
    assert len(provider.calls) == 2
    # Expire only the minute counter in this isolated in-memory store. The
    # account/day and global/day counters retain the same original expiry.
    minute_key = parse("2 per minute").key_for(
        f"user:{owner}", "external-ai-minute-account"
    )
    limiter.storage.expirations[minute_key] = time.time() - 1
    assert post(client, "/api/lessons/greetings/example").status_code == 200
    exhausted = post(client, "/api/lessons/greetings/explain")
    assert exhausted.status_code == 429
    assert exhausted.headers["X-RateLimit-Limit"] == "3"
    assert int(exhausted.headers["Retry-After"]) > 3600
    assert len(provider.calls) == 3


def test_closed_exercises_and_replays_work_with_paid_budget_exhausted(quota_factory):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    client, _ = register(application)
    conversation = post(client, "/api/conversations", {"topicId": "lesson:greetings"})
    identifier = conversation.get_json()["id"]
    sent = post(
        client,
        f"/api/conversations/{identifier}/messages",
        {"text": "I enjoy learning English."},
        headers={"Idempotency-Key": "synthetic-quota-replay"},
    )
    assert sent.status_code == 201
    replay = post(
        client,
        f"/api/conversations/{identifier}/messages",
        {"text": "I enjoy learning English."},
        headers={"Idempotency-Key": "synthetic-quota-replay"},
    )
    assert replay.status_code == 201
    assert replay.get_json() == sent.get_json()
    assert post(client, "/api/lessons/greetings/start").status_code == 204
    exercise = catalog.exercise("greetings-1")["exercise"]
    route = "/api/lessons/greetings/exercises/greetings-1/answer"
    answer = post(client, route, {"answer": exercise["acceptedAnswers"][0]})
    assert answer.status_code == 200
    assert (
        post(client, route, {"answer": exercise["acceptedAnswers"][0]}).get_json()
        == answer.get_json()
    )
    assert post(client, "/api/lessons/greetings/explain").status_code == 429
    assert len(provider.calls) == 1


def test_locally_rejected_writing_does_not_spend_paid_budget(quota_factory):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    client, _ = register(application)
    assert post(client, "/api/lessons/verb-to-be/start").status_code == 204
    result = post(
        client, "/api/lessons/verb-to-be/exercises/to-be-6/answer", {"answer": "hello"}
    )
    assert result.status_code == 200
    assert result.get_json()["status"] == "incorrect"
    assert provider.calls == []
    corrected = post(
        client,
        "/api/lessons/verb-to-be/exercises/to-be-6/answer",
        {"answer": "I am happy today."},
    )
    assert corrected.status_code == 200
    replay = post(
        client,
        "/api/lessons/verb-to-be/exercises/to-be-6/answer",
        {"answer": "I am happy today."},
    )
    assert replay.status_code == 200
    assert replay.get_json() == corrected.get_json()
    assert len(provider.calls) == 1


@pytest.mark.parametrize("kind", ["lesson", "vocabulary"])
def test_local_reviews_work_when_paid_budget_is_exhausted(quota_factory, kind):
    from services.common import now_iso
    from services.revisao import new_review

    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    client, owner = register(application)
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 201
    )
    assert post(client, "/api/lessons/greetings/explain").status_code == 429
    with application.app_context():
        timestamp = now_iso()
        if kind == "vocabulary":
            db.session.add(
                UserVocabulary(
                    user_id=owner,
                    vocabulary_id="red",
                    status="learning",
                    first_seen_at=timestamp,
                    times_reviewed=0,
                    next_review_at=timestamp,
                )
            )
        review = new_review(
            owner,
            kind,
            "greetings" if kind == "lesson" else "vocabulary",
            "low_score" if kind == "lesson" else "vocabulary_due",
            timestamp,
        )
        db.session.add(review)
        db.session.commit()
        identifier = review.id
    started = post(client, f"/api/reviews/{identifier}/session")
    assert started.status_code == 200
    for exercise in started.get_json()["exercises"]:
        authored = catalog.exercise(exercise["id"])["exercise"]
        result = post(
            client,
            f"/api/reviews/{identifier}/answers",
            {"exerciseId": exercise["id"], "answer": authored["acceptedAnswers"][0]},
        )
        assert result.status_code == 200
    assert post(client, f"/api/reviews/{identifier}/complete").status_code == 200
    assert len(provider.calls) == 1


def test_unconfigured_provider_does_not_reserve_quotas(quota_factory):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    provider.configured = False
    client, _ = register(application)
    for _ in range(12):
        assert (
            post(client, "/api/conversations", {"topicId": "introductions"}).status_code
            == 503
        )
    assert provider.calls == []
    provider.configured = True
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 201
    )
    assert len(provider.calls) == 1


def test_context_rejection_does_not_reserve_quotas(quota_factory):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    client, _ = register(application)
    service = application.extensions["english_ai"]
    service.max_context_chars = 1
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 400
    )
    assert provider.calls == []
    service.max_context_chars = 8000
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 201
    )
    assert len(provider.calls) == 1


def test_failed_upstream_attempt_keeps_its_reservation(quota_factory, monkeypatch):
    application, provider = quota_factory(AI_GLOBAL_DAILY_REQUEST_LIMIT=1)
    client, _ = register(application)
    original = provider.complete

    def fail(request):
        provider.calls.append(request)
        raise ProviderError("timeout")

    monkeypatch.setattr(provider, "complete", fail)
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 503
    )
    monkeypatch.setattr(provider, "complete", original)
    assert (
        post(client, "/api/conversations", {"topicId": "introductions"}).status_code
        == 429
    )
    assert len(provider.calls) == 1


def test_quota_store_failure_prevents_provider_call_and_hides_details(
    quota_factory, monkeypatch
):
    application, provider = quota_factory()
    client, _ = register(application)
    original = limiter.limiter.hit
    sentinel = "synthetic-private-backend-detail"

    def fail(item, *identifiers, **kwargs):
        if any(
            str(identifier).startswith("external-ai-") for identifier in identifiers
        ):
            raise RuntimeError(sentinel)
        return original(item, *identifiers, **kwargs)

    monkeypatch.setattr(limiter.limiter, "hit", fail)
    result = post(client, "/api/conversations", {"topicId": "introductions"})
    assert result.status_code == 503
    assert result.get_json()["error"]["code"] == "AI_UNAVAILABLE"
    assert sentinel not in result.get_data(as_text=True)
    assert provider.calls == []


@pytest.mark.parametrize(
    "override",
    [
        {"RATELIMIT_STORAGE_URI": "memory://"},
        {"RATELIMIT_STORAGE_URI": ""},
        {"RATELIMIT_STORAGE_URI": None},
        {"RATELIMIT_STORAGE_URI": "redis://"},
        {"RATELIMIT_STORAGE_URI": "unsupported://localhost"},
        {"RATELIMIT_ENABLED": False},
        {"RATELIMIT_IN_MEMORY_FALLBACK_ENABLED": True},
        {"RATELIMIT_IN_MEMORY_FALLBACK": ["10 per minute"]},
        {"RATELIMIT_SWALLOW_ERRORS": True},
    ],
)
def test_factory_rejects_unsafe_effective_paid_production_settings(
    quota_factory, override
):
    with pytest.raises(ValueError):
        quota_factory(
            **{
                "APP_ENV": "production",
                "RATELIMIT_STORAGE_URI": "rediss://quota.example.invalid:6379/0",
                "SESSION_COOKIE_SECURE": True,
                "APP_PUBLIC_URL": "https://english.example.invalid",
                **override,
            }
        )


@pytest.mark.parametrize(
    "uri",
    [
        "redis://quota.example.invalid:6379/0",
        "rediss://quota.example.invalid:6379/0",
        "redis+unix:///tmp/synthetic-quota.sock",
    ],
)
def test_shared_backend_configuration_validates_without_connecting(audit_app, uri):
    from config import validate_effective_config

    settings = dict(audit_app.config)
    settings.update(
        APP_ENV="production",
        AI_PROVIDER="anthropic",
        RATELIMIT_ENABLED=True,
        RATELIMIT_STORAGE_URI=uri,
        SESSION_COOKIE_SECURE=True,
        APP_PUBLIC_URL="https://english.example.invalid",
    )
    validate_effective_config(settings)


def test_redis_storage_driver_is_installed(audit_app):
    import redis
    from limits.storage import storage_from_string

    storage = storage_from_string("redis://quota.example.invalid:6379/0")
    assert isinstance(storage.storage, redis.Redis)


@pytest.mark.parametrize(
    "override",
    [
        {"SECRET_KEY": ""},
        {"SECRET_KEY": "short-synthetic-secret"},
        {"SECRET_KEY": None},
        {"DEBUG": True},
        {"SESSION_COOKIE_SECURE": False},
        {"SESSION_COOKIE_HTTPONLY": False},
        {"SESSION_COOKIE_SAMESITE": "Lax"},
        {"SESSION_COOKIE_SAMESITE": None},
        {"WTF_CSRF_ENABLED": False},
        pytest.param({"RATELIMIT_ENABLED": False}, id="disabled_rate_limits"),
    ],
)
def test_factory_rejects_unsafe_production_overrides_in_demo_mode(
    quota_factory, override
):
    # Exercise the final factory settings even when the loader supplied a safe
    # testing configuration and no paid provider is enabled.
    with pytest.raises(ValueError):
        quota_factory(
            **{
                "APP_ENV": "production",
                "AI_PROVIDER": "demo",
                "SESSION_COOKIE_SECURE": True,
                "APP_PUBLIC_URL": "https://english.example.invalid",
                **override,
            }
        )
