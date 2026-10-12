"""Synthetic sessions, reset transactions, HTTPS headers and private logs."""

from concurrent.futures import ThreadPoolExecutor
import hashlib
from io import StringIO
import logging
from threading import Barrier

import pytest
from sqlalchemy import select
from werkzeug.serving import WSGIRequestHandler

import app as application_module
from extensions import db
from models import PasswordResetToken, User
from services import autenticacao
from services.request_logging import (
    SafeRequestHandler,
    install_werkzeug_redaction,
    redacted_request_target,
)

NEW_PASSWORD = "ChangedSynthetic2026"


def _copied_client(account, audit_app, audit_client_factory):
    client = audit_client_factory()
    cookie_name = audit_app.config["SESSION_COOKIE_NAME"]
    client.client.set_cookie(
        cookie_name, account["client"].client.get_cookie(cookie_name).value
    )
    return client


def test_login_rotates_csrf_and_rejects_the_prior_anonymous_session_token(
    audit_accounts, audit_app, audit_client_factory
):
    first, second = audit_accounts
    client = audit_client_factory()
    anonymous_csrf = client.get("/api/csrf").get_json()["csrfToken"]
    name = audit_app.config["SESSION_COOKIE_NAME"]
    anonymous_cookie = client.client.get_cookie(name).value
    login = client.post(
        "/api/auth/login",
        csrf=False,
        headers={"X-CSRFToken": anonymous_csrf},
        json={"email": second["email"], "password": "SyntheticAudit2026"},
    )
    assert login.status_code == 200
    assert client.client.get_cookie(name).value != anonymous_cookie
    prior = second["client"].get("/api/me/preferences").get_json()
    stale_csrf = client.patch(
        "/api/me/preferences",
        csrf=False,
        headers={"X-CSRFToken": anonymous_csrf},
        json={"dailyGoalMinutes": 30},
    )
    assert stale_csrf.status_code == 400
    assert stale_csrf.get_json()["error"]["code"] == "CSRF"
    assert second["client"].get("/api/me/preferences").get_json() == prior
    assert (
        client.patch("/api/me/preferences", json={"dailyGoalMinutes": 30}).status_code
        == 200
    )
    assert (
        first["client"].get("/api/me/preferences").get_json()["dailyGoalMinutes"] == 10
    )


def test_reset_token_selects_only_its_owner_preserves_another_active_account(
    audit_accounts, audit_app, audit_client_factory, caplog, monkeypatch
):
    first, second = audit_accounts
    copy = _copied_client(first, audit_app, audit_client_factory)
    with audit_app.app_context():
        other = db.session.get(User, second["user_id"])
        other_before = (other.password_hash, other.session_version)
        reset = autenticacao.request_reset(first["email"])
        token = reset["token"]
        record = db.session.scalar(
            select(PasswordResetToken).where(
                PasswordResetToken.user_id == first["user_id"]
            )
        )
        assert record.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert token != record.token_hash
    caplog.clear()
    monkeypatch.setattr(audit_app.logger, "disabled", False)
    with caplog.at_level(logging.INFO):
        audit_app.logger.info("synthetic.reset.audit.active")
        response = second["client"].post(
            "/api/auth/password-reset/confirm",
            json={
                "token": token,
                "userId": second["user_id"],
                "password": NEW_PASSWORD,
                "passwordConfirmation": NEW_PASSWORD,
            },
        )
    assert response.status_code == 200
    assert response.get_json()["sessionEnded"] is False
    assert "synthetic.reset.audit.active" in caplog.text
    assert token not in caplog.text
    assert NEW_PASSWORD not in caplog.text
    assert first["email"] not in caplog.text
    assert first["client"].get("/api/me").status_code == 401
    assert copy.get("/api/me").status_code == 401
    assert second["client"].get("/api/me").get_json()["user"]["id"] == second["user_id"]
    with audit_app.app_context():
        other = db.session.get(User, second["user_id"])
        assert (other.password_hash, other.session_version) == other_before
        changed = db.session.get(User, first["user_id"])
        assert changed.session_version == 1
        assert autenticacao.verify_password(NEW_PASSWORD, changed.password_hash)
        assert autenticacao.inspect_reset(token)[0] == "used"
    outsider = audit_client_factory()
    for password, expected in (("SyntheticAudit2026", 401), (NEW_PASSWORD, 200)):
        assert (
            outsider.post(
                "/api/auth/login", json={"email": first["email"], "password": password}
            ).status_code
            == expected
        )


def test_concurrent_reset_consumes_token_and_revokes_sessions_exactly_once(
    audit_accounts, audit_app, audit_client_factory, monkeypatch
):
    first, second = audit_accounts
    with audit_app.app_context():
        token = autenticacao.request_reset(first["email"])["token"]
    clients = [audit_client_factory(), audit_client_factory()]
    barrier = Barrier(2)
    original_hash = autenticacao.hash_password

    def synchronized_hash(password):
        result = original_hash(password)
        barrier.wait(timeout=10)
        return result

    monkeypatch.setattr(autenticacao, "hash_password", synchronized_hash)

    def confirm(client):
        return client.post(
            "/api/auth/password-reset/confirm",
            json={
                "token": token,
                "password": NEW_PASSWORD,
                "passwordConfirmation": NEW_PASSWORD,
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(confirm, clients))
    assert sorted(statuses) == [200, 400]
    with audit_app.app_context():
        user = db.session.get(User, first["user_id"])
        assert user.session_version == 1
        assert autenticacao.verify_password(NEW_PASSWORD, user.password_hash)
        assert autenticacao.inspect_reset(token)[0] == "used"
    assert first["client"].get("/api/me").status_code == 401
    assert second["client"].get("/api/me").status_code == 200


def test_password_reset_request_verify_and_confirm_share_one_ip_counter(
    audit_app, audit_client, tmp_path
):
    # audit_app has already replaced dotenv loading and denied all socket connects.
    settings = dict(audit_app.config)
    settings.update(
        {
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'synthetic-reset-rates.db'}",
            "RATELIMIT_ENABLED": True,
            "RATELIMIT_STORAGE_URI": "memory://",
            "RATELIMIT_HEADERS_ENABLED": True,
        }
    )
    rate_app = application_module.create_app(settings)
    client = type(audit_client)(rate_app)
    routes = (
        ("/api/auth/password-reset", {"email": "absent-synthetic@example.test"}, 202),
        ("/api/auth/password-reset/verify", {"token": "invalid-synthetic"}, 200),
        (
            "/api/auth/password-reset/confirm",
            {
                "token": "invalid-synthetic",
                "password": NEW_PASSWORD,
                "passwordConfirmation": NEW_PASSWORD,
            },
            400,
        ),
    )
    try:
        for index in range(10):
            path, payload, expected = routes[index % len(routes)]
            response = client.post(path, json=payload)
            assert response.status_code == expected
        for path, payload, _ in routes:
            response = client.post(path, json=payload)
            assert response.status_code == 429
            assert "Retry-After" in response.headers
        other_ip = client.post(
            "/api/auth/password-reset/verify",
            json={"token": "invalid-synthetic"},
            environ_overrides={"REMOTE_ADDR": "198.51.100.23"},
        )
        assert other_ip.status_code == 200
        with rate_app.app_context():
            assert db.session.query(User).count() == 0
            assert db.session.query(PasswordResetToken).count() == 0
    finally:
        with rate_app.app_context():
            db.session.remove()
            db.engine.dispose()


def test_production_https_sets_secure_cookie_and_headers_on_private_and_error_responses(
    audit_app, tmp_path
):
    settings = dict(audit_app.config)
    settings.update(
        {
            "APP_ENV": "production",
            "APP_PUBLIC_URL": "https://english-ai.example.test",
            "SECRET_KEY": "synthetic-production-key-long-enough-for-validation",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'synthetic-https.db'}",
            "SESSION_COOKIE_SECURE": True,
            "RATELIMIT_ENABLED": True,
        }
    )
    production = application_module.create_app(settings)
    client = production.test_client()
    base_url = "https://english-ai.example.test"
    try:
        token = client.get("/api/csrf", base_url=base_url).get_json()["csrfToken"]
        response = client.post(
            "/api/auth/register",
            base_url=base_url,
            headers={"X-CSRFToken": token, "Referer": base_url + "/cadastro"},
            json={
                "name": "Synthetic HTTPS",
                "email": "https-synthetic@example.test",
                "password": "SyntheticAudit2026",
                "passwordConfirmation": "SyntheticAudit2026",
                "acceptedTerms": True,
            },
        )
        assert response.status_code == 201
        cookie = response.headers["Set-Cookie"]
        assert all(flag in cookie for flag in ("Secure", "HttpOnly", "SameSite=Strict"))
        for path, expected in (
            ("/api/me", 200),
            ("/configuracao", 200),
            ("/api/synthetic-missing", 404),
        ):
            response = client.get(path, base_url=base_url)
            assert response.status_code == expected
            assert response.headers["Strict-Transport-Security"] == "max-age=31536000"
            assert response.headers["Cache-Control"] == "no-store"
            assert response.headers["X-Content-Type-Options"] == "nosniff"
            assert response.headers["X-Frame-Options"] == "DENY"
            assert (
                response.headers["Permissions-Policy"]
                == "camera=(), microphone=(), geolocation=()"
            )
            csp = response.headers["Content-Security-Policy"]
            assert "script-src 'self'" in csp and "frame-ancestors 'none'" in csp
            assert "unsafe-inline" not in csp and "unsafe-eval" not in csp
            assert (
                "includeSubDomains" not in response.headers["Strict-Transport-Security"]
            )
            assert "preload" not in response.headers["Strict-Transport-Security"]
    finally:
        with production.app_context():
            db.session.remove()
            db.engine.dispose()


@pytest.mark.parametrize(
    "path", ["/entrar", "/cadastro", "/recuperar-senha", "/redefinir-senha/" + "s" * 43]
)
def test_auth_and_reset_pages_do_not_send_tokens_in_referrers(audit_client, path):
    response = audit_client.get(path)
    assert response.status_code == 200
    assert response.headers["Referrer-Policy"] == "no-referrer"
    assert response.headers["Cache-Control"] == "no-store"


def _capture_access_log(handler_class, path):
    handler = object.__new__(handler_class)
    handler.command = "GET"
    handler.path = path
    handler.request_version = "HTTP/1.1"
    handler.requestline = "GET " + path + " HTTP/1.1"
    records = []
    handler.log = lambda level, message, *arguments: records.append(message % arguments)
    handler.log_request(200, 120)
    return handler, records


def test_standard_werkzeug_access_log_reproduces_reset_token_exposure_in_memory():
    synthetic_token = "synthetic-never-valid-reset-token"
    _, baseline = _capture_access_log(
        WSGIRequestHandler, "/redefinir-senha/" + synthetic_token
    )
    assert any(synthetic_token in entry for entry in baseline)


@pytest.mark.parametrize(
    "path",
    [
        "/redefinir-senha/synthetic-never-valid-reset-token?email=synthetic@example.test",
        "/%72edefinir-senha/synthetic-never-valid-reset-token?token=synthetic-query-secret",
        "//redefinir-senha/synthetic-never-valid-reset-token?token=synthetic-query-secret",
        "https://synthetic-user:synthetic-password@example.test/redefinir-senha/synthetic-never-valid-reset-token",
    ],
)
def test_safe_access_log_redacts_reset_token_query_and_authority_without_changing_dispatch(
    path,
):
    handler, records = _capture_access_log(SafeRequestHandler, path)
    assert handler.path == path
    assert records == ['"GET /redefinir-senha/[redacted] HTTP/1.1" 200 120']
    assert "synthetic-" not in records[0]


def test_safe_access_log_drops_query_strings_and_escapes_control_characters():
    handler, records = _capture_access_log(
        SafeRequestHandler, "/api/me?password=synthetic-query-password"
    )
    assert handler.path.endswith("password=synthetic-query-password")
    assert records == ['"GET /api/me HTTP/1.1" 200 120']
    assert (
        redacted_request_target("/untrusted%0apath?token=synthetic")
        == r"/untrusted\x0apath"
    )
    assert redacted_request_target("https://[") == "[invalid-target]"


def test_default_werkzeug_handler_logs_are_redacted_by_the_factory_filter(
    caplog, monkeypatch
):
    install_werkzeug_redaction()
    logger = logging.getLogger("werkzeug")
    monkeypatch.setattr(logger, "disabled", False)
    count_before = len(logger.filters)
    install_werkzeug_redaction()
    assert len(logger.filters) == count_before
    handler = object.__new__(WSGIRequestHandler)
    handler.command = "GET"
    handler.path = "/redefinir-senha/synthetic-reset-token?email=synthetic@example.test"
    handler.request_version = "HTTP/1.1"
    handler.client_address = ("127.0.0.1", 12345)
    caplog.clear()
    with caplog.at_level(logging.INFO, logger="werkzeug"):
        handler.log_request(200, 120)
    assert "/redefinir-senha/[redacted]" in caplog.text
    assert "GET " in caplog.text and "200 120" in caplog.text
    assert "synthetic-reset-token" not in caplog.text
    assert "synthetic@example.test" not in caplog.text
    assert handler.path.endswith("email=synthetic@example.test")


def test_werkzeug_filter_does_not_reveal_malformed_reset_request_lines(
    caplog, monkeypatch
):
    install_werkzeug_redaction()
    logger = logging.getLogger("werkzeug")
    monkeypatch.setattr(logger, "disabled", False)
    caplog.clear()
    with caplog.at_level(logging.ERROR, logger="werkzeug"):
        logger.error(
            "Bad request syntax: %s", "/%72edefinir-senha/synthetic-malformed-token"
        )
    assert "synthetic-malformed-token" not in caplog.text
    assert "[redacted]" in caplog.text


def test_werkzeug_filter_redacts_query_on_lowercase_unsupported_method(
    caplog, monkeypatch
):
    install_werkzeug_redaction()
    logger = logging.getLogger("werkzeug")
    monkeypatch.setattr(logger, "disabled", False)
    caplog.clear()
    with caplog.at_level(logging.INFO, logger="werkzeug"):
        logger.info(
            '"%s" %s %s', "get /api/me?token=synthetic-secret HTTP/1.1", 405, 10
        )
    assert "get /api/me HTTP/1.1" in caplog.text
    assert "synthetic-secret" not in caplog.text


def test_automatic_migrations_preserve_enabled_access_logging_and_redaction(
    audit_app, tmp_path, monkeypatch
):
    logger = logging.getLogger("werkzeug")
    monkeypatch.setattr(logger, "disabled", False)
    settings = dict(audit_app.config)
    settings["SQLALCHEMY_DATABASE_URI"] = (
        f"sqlite:///{tmp_path / 'synthetic-logger-migration.db'}"
    )
    migrated = application_module.create_app(settings)
    captured = StringIO()
    capture_handler = logging.StreamHandler(captured)
    logger.addHandler(capture_handler)
    prior_level = logger.level
    try:
        assert logger.disabled is False
        # fileConfig replaces root handlers, including pytest's capture handler.
        # An explicit in-memory handler proves emission after that operation.
        logger.setLevel(logging.INFO)
        logger.info(
            '"%s" %s %s',
            "GET /redefinir-senha/synthetic-migration-token HTTP/1.1",
            200,
            10,
        )
        assert "/redefinir-senha/[redacted]" in captured.getvalue()
        assert "synthetic-migration-token" not in captured.getvalue()
    finally:
        logger.setLevel(prior_level)
        logger.removeHandler(capture_handler)
        capture_handler.close()
        with migrated.app_context():
            db.session.remove()
            db.engine.dispose()
