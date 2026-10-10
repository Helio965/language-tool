"""Authentication with a real database, legacy hashes and failure rollback."""

import base64
import hashlib
import re
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import pytest
from extensions import db
from models import (
    User,
    LearningProfile,
    Preferences,
    PasswordResetToken,
    Conversation,
    Message,
)
from services import autenticacao

USER = {
    "name": "Carla Dias",
    "email": "carla@example.com",
    "password": "segura123",
    "passwordConfirmation": "segura123",
    "acceptedTerms": True,
}
NEW_PASSWORD = {"password": "novaSenha9", "passwordConfirmation": "novaSenha9"}


def register(client, **changes):
    return client.post("/api/auth/register", json={**USER, **changes})


def reset_token(app, client):
    service = app.extensions["email_service"]
    service.transport = "memory"
    response = client.post("/api/auth/password-reset", json={"email": USER["email"]})
    assert response.status_code == 202
    return re.search(
        r"/redefinir-senha/([A-Za-z0-9_-]{43})", service.messages[-1]["text"]
    ).group(1)


def test_register_login_duplicate_and_validation(client, app):
    created = register(client, email=" Carla@Example.com ")
    assert created.status_code == 201
    assert created.json["user"]["email"] == USER["email"]
    assert created.json["nextStep"] == "onboarding"
    assert "passwordHash" not in created.json["user"]
    assert register(client).status_code == 409
    assert (
        register(client, email="other@example.com", password="short1").status_code
        == 400
    )
    assert (
        register(client, email="third@example.com", acceptedTerms="true").status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": USER["email"], "password": "wrongpass1"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "absent@example.com", "password": "wrongpass1"},
        ).json["error"]["code"]
        == "INVALID_CREDENTIALS"
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": USER["email"], "password": USER["password"]},
        ).status_code
        == 200
    )
    with app.app_context():
        user = db.session.scalar(db.select(User))
        assert user.password_hash.startswith("scrypt$16384$8$1$")
        assert db.session.get(LearningProfile, user.id)
        assert db.session.get(Preferences, user.id)


def test_scrypt_node_format_and_malformed_hashes():
    # Fixed vectors in exactly the Node ScryptPasswordHasher storage format.
    salt = bytes(range(16))
    key = hashlib.scrypt("legado123".encode(), salt=salt, n=16384, r=8, p=1, dklen=64)
    stored = (
        "scrypt$16384$8$1$"
        + base64.b64encode(salt).decode()
        + "$"
        + base64.b64encode(key).decode()
    )
    assert autenticacao.verify_password("legado123", stored)
    assert not autenticacao.verify_password("wrong123", stored)
    for malformed in (
        "plaintext",
        "scrypt$2$8$1$!$!",
        stored.replace("$16384$", "$999999999$"),
    ):
        assert not autenticacao.verify_password("legado123", malformed)


def test_profile_preferences_strict_inputs(client):
    register(client)
    data = {
        "goal": "work",
        "perceivedLevel": "beginner",
        "priorExperience": "school",
        "conversationInterest": True,
        "professionalInterest": True,
        "interestAreas": ["business", "technology"],
    }
    response = client.put("/api/me/profile", json=data)
    assert response.status_code == 200
    assert response.json["onboardingCompletedAt"]
    assert client.put("/api/me/profile", json={**data, "goal": []}).status_code == 400
    assert (
        client.put(
            "/api/me/profile",
            json={**data, "interestAreas": ["business", "travel", "food", "everyday"]},
        ).status_code
        == 400
    )
    assert (
        client.patch("/api/me/preferences", json={"dailyGoalMinutes": True}).status_code
        == 400
    )
    assert (
        client.patch(
            "/api/me/preferences", json={"showTranslations": "false"}
        ).status_code
        == 400
    )
    updated = client.patch(
        "/api/me/preferences", json={"dailyGoalMinutes": 20, "showTranslations": False}
    )
    assert updated.json["dailyGoalMinutes"] == 20
    assert updated.json["showTranslations"] is False


def test_reset_response_hash_only_cooldown_and_public_domain(app, client):
    register(client)
    token = reset_token(app, client)
    known = client.post("/api/auth/password-reset", json={"email": USER["email"]})
    unknown = client.post(
        "/api/auth/password-reset", json={"email": "unknown@example.com"}
    )
    assert known.status_code == unknown.status_code == 202
    assert known.json == unknown.json
    assert len(app.extensions["email_service"].messages) == 1
    with app.app_context():
        record = db.session.scalar(db.select(PasswordResetToken))
        assert record.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert token not in repr(record.__dict__)
    assert (
        "http://localhost:5000/redefinir-senha/"
        in app.extensions["email_service"].messages[0]["text"]
    )


def test_reset_single_use_revokes_all_devices_and_old_password(app, client):
    register(client)
    other = app.test_client()
    assert (
        other.post(
            "/api/auth/login",
            json={"email": USER["email"], "password": USER["password"]},
        ).status_code
        == 200
    )
    token = reset_token(app, client)
    assert (
        client.post("/api/auth/password-reset/verify", json={"token": token}).json[
            "status"
        ]
        == "valid"
    )
    weak = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "password": "weak1", "passwordConfirmation": "weak1"},
    )
    assert weak.status_code == 400
    confirmed = client.post(
        "/api/auth/password-reset/confirm", json={"token": token, **NEW_PASSWORD}
    )
    assert confirmed.json["sessionEnded"] is True
    assert other.get("/api/me").status_code == 401
    assert other.get("/api/auth/session").json == {"account": None}
    assert (
        client.post("/api/auth/password-reset/verify", json={"token": token}).json[
            "status"
        ]
        == "used"
    )
    assert (
        client.post(
            "/api/auth/password-reset/confirm", json={"token": token, **NEW_PASSWORD}
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": USER["email"], "password": USER["password"]},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": USER["email"], "password": NEW_PASSWORD["password"]},
        ).status_code
        == 200
    )


def test_reset_expiration_boundary_and_old_link_replacement(app, client):
    register(client)
    first = reset_token(app, client)
    with app.app_context():
        record = db.session.scalar(db.select(PasswordResetToken))
        record.created_at = "2000-01-01T00:00:00.000Z"
        db.session.commit()
    second = reset_token(app, client)
    assert first != second
    assert (
        client.post("/api/auth/password-reset/verify", json={"token": first}).json[
            "status"
        ]
        == "invalid"
    )
    with app.app_context():
        record = db.session.scalar(db.select(PasswordResetToken))
        app.config["NOW"] = lambda: datetime.fromisoformat(
            record.expires_at.replace("Z", "+00:00")
        )
        boundary = datetime.fromisoformat(record.expires_at.replace("Z", "+00:00"))
        app.config["NOW"] = lambda: boundary
    assert (
        client.post("/api/auth/password-reset/verify", json={"token": second}).json[
            "status"
        ]
        == "expired"
    )
    assert (
        client.post(
            "/api/auth/password-reset/confirm", json={"token": second, **NEW_PASSWORD}
        ).status_code
        == 400
    )


def test_reset_commit_failure_preserves_token_and_old_password(
    app, client, monkeypatch
):
    register(client)
    token = reset_token(app, client)
    with app.app_context():

        def fail_commit():
            raise RuntimeError("simulated commit failure")

        monkeypatch.setattr(db.session, "commit", fail_commit)
        with pytest.raises(RuntimeError):
            autenticacao.reset_password({"token": token, **NEW_PASSWORD})
        monkeypatch.undo()
        assert autenticacao.inspect_reset(token)[0] == "valid"
        user = db.session.scalar(db.select(User))
        assert user.session_version == 0
        assert autenticacao.verify_password(USER["password"], user.password_hash)


def test_registration_failure_rolls_back_all_three_records(app, monkeypatch):
    with app.app_context():

        def fail_commit():
            raise RuntimeError("simulated commit failure")

        monkeypatch.setattr(db.session, "commit", fail_commit)
        with pytest.raises(RuntimeError):
            autenticacao.register(USER)
        monkeypatch.undo()
        assert db.session.scalar(db.select(db.func.count()).select_from(User)) == 0
        assert (
            db.session.scalar(db.select(db.func.count()).select_from(LearningProfile))
            == 0
        )
        assert (
            db.session.scalar(db.select(db.func.count()).select_from(Preferences)) == 0
        )


def test_concurrent_reset_consumes_token_once_with_two_db_connections(
    app, client, monkeypatch
):
    register(client)
    token = reset_token(app, client)
    original_hash = autenticacao.hash_password
    ready = Barrier(2)

    def synchronized_hash(password):
        ready.wait(timeout=5)
        return original_hash(password)

    monkeypatch.setattr(autenticacao, "hash_password", synchronized_hash)

    def attempt():
        with app.app_context():
            try:
                autenticacao.reset_password({"token": token, **NEW_PASSWORD})
                return "success"
            except autenticacao.AppError as error:
                return error.code
            finally:
                db.session.remove()

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(results) == ["RESET_TOKEN_INVALID", "success"]
    with app.app_context():
        assert db.session.scalar(db.select(User)).session_version == 1


def test_delete_account_requires_password_and_cascades(app, client):
    created = register(client)
    user_id = created.json["user"]["id"]
    reset_token(app, client)
    with app.app_context():
        conversation = Conversation(
            id="deletion-conversation",
            user_id=user_id,
            topic_id="everyday",
            title="Practice",
            level_at_start="beginner",
            context={},
            retention="saved",
            created_at="2026-01-01T00:00:00.000Z",
            updated_at="2026-01-01T00:00:00.000Z",
        )
        db.session.add(conversation)
        db.session.flush()
        db.session.add(
            Message(
                id="deletion-message",
                conversation_id=conversation.id,
                role="user",
                content="Hello",
                created_at="2026-01-01T00:00:00.000Z",
            )
        )
        db.session.commit()
    assert client.delete("/api/me", json={"password": "wrong123"}).status_code == 400
    assert (
        client.delete("/api/me", json={"password": USER["password"]}).status_code == 204
    )
    assert client.get("/api/me").status_code == 401
    with app.app_context():
        for model in (
            User,
            LearningProfile,
            Preferences,
            PasswordResetToken,
            Conversation,
            Message,
        ):
            assert db.session.scalar(db.select(db.func.count()).select_from(model)) == 0


def test_email_html_escape_and_smtp_failure_does_not_break_account(
    app, client, monkeypatch
):
    service = app.extensions["email_service"]
    service.transport = "memory"
    created = register(client, name="<script>alert(1)</script> Carla")
    assert created.status_code == 201
    assert "<script>" not in service.messages[0]["html"]
    assert "&lt;script&gt;" in service.messages[0]["html"]
    assert USER["password"] not in service.messages[0]["text"]
    service.transport = "smtp"
    service.config.update(SMTP_HOST="smtp.invalid.example", SMTP_SECURE=False)

    def unavailable(*args, **kwargs):
        raise OSError("SMTP detail must never reach response")

    monkeypatch.setattr("services.email.smtplib.SMTP", unavailable)
    other = register(client, email="second@example.com")
    service.idle()
    assert other.status_code == 201
    assert "SMTP" not in str(other.json)
    assert client.get("/api/me").status_code == 200
