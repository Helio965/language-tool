"""Delivery failures must not corrupt accounts or claim success."""

import logging
from concurrent.futures import Future
from unittest.mock import Mock
from extensions import db
from models import PasswordResetToken
from tests.test_auth import register, USER


def test_disabled_reset_does_not_enumerate_accounts_or_create_tokens(app, client):
    register(client)
    service = app.extensions["email_service"]
    assert service.idle()
    service.transport = "disabled"
    known = client.post("/api/auth/password-reset", json={"email": USER["email"]})
    absent = client.post(
        "/api/auth/password-reset", json={"email": "absent@example.test"}
    )
    assert known.status_code == absent.status_code == 503
    assert known.json == absent.json
    with app.app_context():
        assert (
            db.session.scalar(
                db.select(db.func.count()).select_from(PasswordResetToken)
            )
            == 0
        )


def test_queue_submission_failure_does_not_break_committed_registration(
    app, client, monkeypatch, caplog
):
    service = app.extensions["email_service"]
    monkeypatch.setattr(
        service._pool,
        "submit",
        Mock(side_effect=RuntimeError("private-token@example.test")),
    )
    with caplog.at_level(logging.ERROR):
        response = register(client)
    assert response.status_code == 201
    assert (
        client.get("/api/auth/session").json["account"]["user"]["email"]
        == USER["email"]
    )
    assert "email.queue_failed" in caplog.text
    assert "private-token@example.test" not in caplog.text


def test_failed_smtp_reset_receipt_never_claims_delivery(
    app, client, monkeypatch, caplog
):
    register(client)
    service = app.extensions["email_service"]
    assert service.idle()
    service.transport = "smtp"
    service.config.update(SMTP_HOST="smtp.example.test", SMTP_SECURE=False)
    monkeypatch.setattr(
        "services.email.smtplib.SMTP",
        Mock(side_effect=OSError("secret-token-private@example.test")),
    )
    with caplog.at_level(logging.ERROR):
        known = client.post("/api/auth/password-reset", json={"email": USER["email"]})
        assert service.idle()
        absent = client.post(
            "/api/auth/password-reset", json={"email": "absent@example.test"}
        )
    assert known.status_code == absent.status_code == 202 and known.json == absent.json
    assert "Solicitação recebida" in known.json["message"]
    assert (
        "enviaremos" not in known.json["message"]
        and "enviado" not in known.json["message"]
    )
    assert "email.failed" in caplog.text
    assert "secret-token-private@example.test" not in caplog.text


def test_queue_is_bounded_and_idle_does_not_wait_forever(app, monkeypatch):
    service = app.extensions["email_service"]
    tasks = []

    def pending(*_args):
        task = Future()
        tasks.append(task)
        return task

    monkeypatch.setattr(service._pool, "submit", pending)
    message = {"kind": "welcome"}
    assert all(service.dispatch(message) for _ in range(32))
    assert service.dispatch(message) is False
    assert service.idle(timeout=0) is False
    for task in tasks:
        task.set_result(None)
    assert service.idle(timeout=0) is True
    assert service.dispatch(message) is True
    tasks[-1].set_result(None)


def test_smtp_upgrades_tls_before_login_and_preserves_certificate_verification(
    app, monkeypatch
):
    from types import SimpleNamespace
    import ssl

    service = app.extensions["email_service"]
    assert service.idle()
    service.transport = "smtp"
    service.config.update(
        SMTP_HOST="smtp.example.test",
        SMTP_PORT=587,
        SMTP_SECURE=False,
        SMTP_USER="test-user",
        SMTP_PASSWORD="test-only-password",
    )
    operations = []

    class Connection:
        def __init__(self, _host, _port, timeout):
            assert timeout == 10

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def starttls(self, context):
            assert context.check_hostname and context.verify_mode == ssl.CERT_REQUIRED
            operations.append("tls")

        def login(self, _user, _password):
            operations.append("login")

        def send_message(self, message):
            operations.append("send")
            assert (
                "Projeto acadêmico"
                not in message.get_body(preferencelist=("plain",)).get_content()
            )
            return {}

    monkeypatch.setattr("services.email.smtplib.SMTP", Connection)
    user = SimpleNamespace(name="Test Learner", email="learner@example.test")
    assert service.send_welcome(user)
    assert service.idle()
    assert operations == ["tls", "login", "send"]
