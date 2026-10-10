"""Regression journeys for retained history, incomplete accounts and activity clocks."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import sqlite3

import pytest
from sqlalchemy.orm import Session

from app import create_app
from extensions import db
from models import Conversation, LearningProfile, Message, Preferences, User
from services import autenticacao, conversacao, perfil, progresso
from services.common import iso


def register(client):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Legacy User",
            "email": "legacy-state@example.com",
            "password": "LegacyPass123",
            "passwordConfirmation": "LegacyPass123",
            "acceptedTerms": True,
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["user"]["id"]


def test_old_equal_timestamp_history_keeps_insertion_order_and_provider_context(
    app, client
):
    register(client)
    conversation_id = client.post(
        "/api/conversations", json={"topicId": "introductions"}
    ).get_json()["id"]
    timestamp = "2026-01-01T00:00:00.000Z"
    with app.app_context():
        db.session.execute(
            db.delete(Message).where(Message.conversation_id == conversation_id)
        )
        # This is the old store's insertion sequence; UUID lexical order differs.
        for identifier, role, text in (
            ("z-old-user", "user", "I live in Recife."),
            ("a-old-assistant", "assistant", "What do you like about Recife?"),
        ):
            db.session.add(
                Message(
                    id=identifier,
                    conversation_id=conversation_id,
                    role=role,
                    content=text,
                    created_at=timestamp,
                    corrections=[],
                    deferred_corrections=[],
                    notices=[],
                )
            )
            db.session.flush()
        db.session.commit()
    result = client.get("/api/conversations/" + conversation_id)
    assert [message["role"] for message in result.get_json()["messages"]] == [
        "user",
        "assistant",
    ]

    original_service = app.extensions["english_ai"]
    seen = []

    class CaptureHistory:
        def conversation(self, data):
            seen.extend(data["history"])
            return original_service.conversation(data)

    app.extensions["english_ai"] = CaptureHistory()
    response = client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"text": "I like the parks."},
    )
    assert response.status_code == 201, response.get_json()
    assert [message["role"] for message in seen] == ["user", "assistant"]


@pytest.mark.parametrize("missing", ["profile", "preferences", "both"])
def test_imported_account_missing_children_logs_in_and_keeps_existing_values(
    tmp_path, missing
):
    path = tmp_path / "legacy-incomplete.db"
    timestamp = "2025-01-01T00:00:00.000Z"
    with sqlite3.connect(path) as connection:
        connection.executescript(
            (Path(__file__).parents[1] / "apps/api/src/db/schema.sql").read_text()
        )
        connection.execute(
            "INSERT INTO users(id,name,email,password_hash,created_at,terms_accepted_at) VALUES(?,?,?,?,?,?)",
            (
                "legacy-user",
                "Legacy User",
                "legacy-state@example.com",
                autenticacao.hash_password("LegacyPass123"),
                timestamp,
                timestamp,
            ),
        )
        if missing != "profile" and missing != "both":
            connection.execute(
                "INSERT INTO learning_profiles(user_id,goal,estimated_level,onboarding_completed_at,placement_completed_at,updated_at) VALUES(?,?,?,?,?,?)",
                ("legacy-user", "travel", "basic", timestamp, timestamp, timestamp),
            )
        if missing != "preferences" and missing != "both":
            connection.execute(
                "INSERT INTO preferences(user_id,explanation_language,reply_length,save_conversation_history,updated_at) VALUES(?,?,?,?,?)",
                ("legacy-user", "en", "short", 0, timestamp),
            )
    application = create_app(
        {
            "TESTING": True,
            "AUTO_INIT_DB": True,
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": False,
            "MAIL_TRANSPORT": "memory",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{path}",
        }
    )
    client = application.test_client()
    login = client.post(
        "/api/auth/login",
        json={"email": "legacy-state@example.com", "password": "LegacyPass123"},
    )
    assert login.status_code == 200, login.get_json()
    assert client.get("/api/home").status_code == 200
    account = client.get("/api/me").get_json()
    if missing == "preferences":
        assert account["profile"]["goal"] == "travel"
        assert account["profile"]["estimatedLevel"] == "basic"
    if missing == "profile":
        assert account["preferences"]["explanationLanguage"] == "en"
        assert account["preferences"]["replyLength"] == "short"
        assert account["preferences"]["saveConversationHistory"] is False
    with application.app_context():
        assert db.session.get(LearningProfile, "legacy-user") is not None
        assert db.session.get(Preferences, "legacy-user") is not None
        db.session.remove()
        db.engine.dispose()


def test_default_repair_does_not_commit_unrelated_pending_changes(app, client):
    user_id = register(client)
    with app.app_context():
        db.session.delete(db.session.get(LearningProfile, user_id))
        db.session.commit()
        user = db.session.get(User, user_id)
        user.name = "Uncommitted unrelated edit"
        assert perfil.load_profile(user_id).user_id == user_id
        with Session(db.engine) as separate:
            assert separate.get(User, user_id).name == "Legacy User"
            assert separate.get(LearningProfile, user_id) is not None
        db.session.rollback()
        assert db.session.get(User, user_id).name == "Legacy User"
        assert db.session.get(LearningProfile, user_id) is not None


@pytest.mark.parametrize("action", ["end", "remove", "purge", "disable-history"])
def test_cleanup_and_returning_later_do_not_inflate_study_time(app, client, action):
    clock = datetime(2026, 1, 1, 12, tzinfo=timezone.utc)
    app.config["NOW"] = lambda: clock
    user_id = register(client)
    conversation_id = client.post(
        "/api/conversations", json={"topicId": "introductions"}
    ).get_json()["id"]
    clock += timedelta(minutes=2)
    sent = client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"text": "I like the parks."},
    )
    assert sent.status_code == 201, sent.get_json()
    with app.app_context():
        activity_timestamp = db.session.get(Conversation, conversation_id).updated_at
        seconds = progresso.conversation_seconds(
            db.session.get(Conversation, conversation_id)
        )
        assert seconds == 120
    clock += timedelta(days=100)
    with app.app_context():
        if action == "end":
            conversacao.end(user_id, conversation_id)
        elif action == "remove":
            conversacao.remove(user_id, conversation_id)
        elif action == "purge":
            conversacao.purge_expired(user_id)
        else:
            perfil.update_preferences(user_id, {"saveConversationHistory": False})
        record = db.session.get(Conversation, conversation_id)
        assert record.updated_at == activity_timestamp
        assert progresso.conversation_seconds(record) == seconds
        assert progresso.snapshot(user_id)[0]["totals"]["studyMinutes"] == 2
        feedback = conversacao.end(user_id, conversation_id)
        assert feedback["contentDeleted"] is True
        assert feedback["durationMinutes"] == 2
