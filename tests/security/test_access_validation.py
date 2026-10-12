"""Access control and malformed input checks on the synthetic audit boundary."""

import os
import stat
from pathlib import Path

import pytest
from sqlalchemy.exc import OperationalError

import app as application_module
from content import catalog
from extensions import db
from models import Conversation, Message, Progress, Review, User, UserVocabulary
from services.aprendizagem import study_seconds
from services.common import AppError
from models.migration import initialize_database


def prepare_completed_exercises(client):
    assert client.post("/api/lessons/greetings/start").status_code == 204
    for exercise in catalog.lesson("greetings")["exercises"]:
        answer = (
            "Hello, my name is Ana."
            if exercise["type"] == "write"
            else exercise["acceptedAnswers"][0]
        )
        response = client.post(
            f"/api/lessons/greetings/exercises/{exercise['id']}/answer",
            json={"answer": answer},
        )
        assert response.status_code == 200
        assert response.get_json()["status"] == "correct"


@pytest.mark.parametrize("status", [[], {}, None, True, 1, "admin"])
def test_vocabulary_container_status_is_rejected(audit_accounts, audit_app, status):
    account, _ = audit_accounts
    response = account["client"].put(
        "/api/vocabulary/red/status", json={"status": status}
    )
    assert response.status_code == 400
    with audit_app.app_context():
        assert db.session.get(UserVocabulary, (account["user_id"], "red")) is None


@pytest.mark.parametrize("seconds", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_study_time_is_rejected(audit_accounts, audit_app, seconds):
    account, _ = audit_accounts
    client = account["client"]
    prepare_completed_exercises(client)
    response = client.post(
        "/api/lessons/greetings/complete", json={"timeSpentSeconds": seconds}
    )
    assert response.status_code == 400
    with audit_app.app_context():
        progress = db.session.get(Progress, (account["user_id"], "greetings"))
        assert progress.status == "in_progress"
        assert progress.completion_result is None
        assert progress.time_spent_seconds == 0
    assert (
        client.post(
            "/api/lessons/greetings/complete", json={"timeSpentSeconds": 30}
        ).status_code
        == 200
    )


def test_domain_study_time_rejects_nonfinite_numbers():
    # The domain boundary also protects non-HTTP callers of completion services.
    for value in (float("nan"), float("inf"), float("-inf"), 10**1000):
        with pytest.raises(AppError, match="Tempo de estudo inválido"):
            study_seconds(value)


def test_surrogate_password_is_rejected(audit_client, audit_app):
    response = audit_client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Invalid Unicode",
            "email": "invalid-unicode@example.test",
            "password": "SyntheticAudit2026\ud800",
            "passwordConfirmation": "SyntheticAudit2026\ud800",
            "acceptedTerms": True,
        },
    )
    assert response.status_code == 400
    with audit_app.app_context():
        assert db.session.query(User).count() == 0


def start_conversation(client):
    response = client.post("/api/conversations", json={"topicId": "introductions"})
    assert response.status_code == 201
    return response.get_json()["id"]


def test_conversation_ownership_protects_all_methods(audit_accounts, audit_app):
    owner, other = audit_accounts
    owner_client, other_client = owner["client"], other["client"]
    conversation_id = start_conversation(owner_client)
    private_text = "My synthetic private study detail belongs to account A."
    assert (
        owner_client.post(
            f"/api/conversations/{conversation_id}/messages",
            json={"text": private_text},
        ).status_code
        == 201
    )
    for method, suffix, payload in (
        ("get", "", None),
        ("post", "/messages", {"text": "Attempted unauthorized message"}),
        ("post", "/end", {}),
        ("delete", "", None),
    ):
        response = getattr(other_client, method)(
            f"/api/conversations/{conversation_id}{suffix}",
            **({"json": payload} if payload is not None else {}),
        )
        assert response.status_code == 404
        assert private_text not in response.get_data(as_text=True)
    assert other_client.get("/api/conversations").get_json() == []
    assert other_client.delete("/api/conversations").get_json()["deleted"] == 0
    own_response = owner_client.get(f"/api/conversations/{conversation_id}").get_json()
    assert any(item["content"] == private_text for item in own_response["messages"])
    with audit_app.app_context():
        conversation = db.session.get(Conversation, conversation_id)
        assert conversation.user_id == owner["user_id"]
        assert conversation.ended_at is None
        assert conversation.content_deleted_at is None
        assert conversation.user_message_count == 1
        assert db.session.query(Message).count() == 3


def create_review(audit_app, user_id):
    with audit_app.app_context():
        review = Review(
            id="synthetic-owned-review",
            user_id=user_id,
            kind="lesson",
            ref_id="greetings",
            reason="low_score",
            status="pending",
            due_at="2020-01-01T00:00:00.000Z",
            interval_step=0,
            times_reviewed=0,
            time_spent_seconds=0,
            created_at="2020-01-01T00:00:00.000Z",
        )
        db.session.add(review)
        db.session.commit()
        return review.id


def test_review_ownership_protects_all_methods(audit_accounts, audit_app):
    owner, other = audit_accounts
    review_id = create_review(audit_app, owner["user_id"])
    for suffix, payload in (
        ("session", {}),
        ("answers", {"exerciseId": "greetings-1", "answer": "Hello"}),
        ("complete", {"score": 100, "correct": 100, "userId": owner["user_id"]}),
    ):
        response = other["client"].post(
            f"/api/reviews/{review_id}/{suffix}", json=payload
        )
        assert response.status_code == 404
    with audit_app.app_context():
        review = db.session.get(Review, review_id)
        assert review.user_id == owner["user_id"]
        assert review.status == "pending"
        assert review.session_exercise_ids is None
        assert review.times_reviewed == 0
        assert review.completion_result is None
    assert (
        owner["client"].post(f"/api/reviews/{review_id}/session", json={}).status_code
        == 200
    )


def test_anonymous_clients_cannot_access_owned_resources(
    audit_accounts, audit_app, audit_client_factory
):
    owner, _ = audit_accounts
    conversation_id = start_conversation(owner["client"])
    review_id = create_review(audit_app, owner["user_id"])
    anonymous = audit_client_factory()
    for method, path, payload in (
        ("get", f"/api/conversations/{conversation_id}", None),
        ("post", f"/api/conversations/{conversation_id}/messages", {"text": "Hello"}),
        ("post", f"/api/conversations/{conversation_id}/end", {}),
        ("delete", f"/api/conversations/{conversation_id}", None),
        ("post", f"/api/reviews/{review_id}/session", {}),
        (
            "post",
            f"/api/reviews/{review_id}/answers",
            {"exerciseId": "greetings-1", "answer": "Hello"},
        ),
        ("post", f"/api/reviews/{review_id}/complete", {}),
    ):
        response = getattr(anonymous, method)(
            path, **({"json": payload} if payload is not None else {})
        )
        assert response.status_code == 401
        assert response.get_json()["error"]["code"] == "UNAUTHENTICATED"
    with audit_app.app_context():
        assert db.session.get(Conversation, conversation_id).user_message_count == 0
        assert db.session.get(Review, review_id).session_exercise_ids is None


def test_registration_ignores_privileged_mass_assignment(
    audit_accounts, audit_client, audit_app
):
    owner, _ = audit_accounts
    response = audit_client.post(
        "/api/auth/register",
        json={
            "name": "Synthetic Third Account",
            "email": "audit-c@example.test",
            "password": "SyntheticAudit2026",
            "passwordConfirmation": "SyntheticAudit2026",
            "acceptedTerms": True,
            "id": owner["user_id"],
            "userId": owner["user_id"],
            "role": "admin",
            "sessionVersion": 999,
            "passwordHash": "attacker-hash",
        },
    )
    assert response.status_code == 201
    user = response.get_json()["user"]
    assert user["role"] == "user"
    assert user["id"] != owner["user_id"]
    assert "passwordHash" not in user and "sessionVersion" not in user
    with audit_app.app_context():
        created = db.session.get(User, user["id"])
        assert created.session_version == 0
        assert created.password_hash != "attacker-hash"
        assert db.session.get(User, owner["user_id"]).name == "Synthetic Audit A"


def test_profile_preferences_and_vocabulary_ignore_other_user_id(audit_accounts):
    owner, other = audit_accounts
    client = other["client"]
    assert (
        client.put(
            "/api/me/profile",
            json={
                "userId": owner["user_id"],
                "role": "admin",
                "sessionVersion": 999,
                "estimatedLevel": "advanced",
                "goal": "work",
                "perceivedLevel": "advanced",
                "priorExperience": "school",
                "conversationInterest": True,
                "professionalInterest": True,
                "interestAreas": ["business"],
            },
        ).status_code
        == 200
    )
    assert (
        client.patch(
            "/api/me/preferences",
            json={
                "userId": owner["user_id"],
                "dailyGoalMinutes": 20,
                "saveConversationHistory": False,
            },
        ).status_code
        == 200
    )
    assert (
        owner["client"]
        .put("/api/vocabulary/red/status", json={"status": "learning"})
        .status_code
        == 200
    )
    assert (
        client.put(
            "/api/vocabulary/red/status",
            json={
                "userId": owner["user_id"],
                "status": "learned",
            },
        ).status_code
        == 200
    )
    unchanged = owner["client"].get("/api/me").get_json()
    changed = client.get("/api/me").get_json()
    assert unchanged["profile"]["goal"] == "basics"
    assert unchanged["preferences"]["dailyGoalMinutes"] == 10
    assert unchanged["preferences"]["saveConversationHistory"] is True
    assert changed["profile"]["goal"] == "work"
    assert changed["profile"]["estimatedLevel"] == "beginner"
    assert changed["user"]["role"] == "user"
    assert changed["preferences"]["dailyGoalMinutes"] == 20
    assert owner["client"].get("/api/vocabulary/red").get_json()["status"] == "learning"
    assert client.get("/api/vocabulary/red").get_json()["status"] == "learned"


@pytest.mark.parametrize(
    "path,method,payload",
    [
        ("/api/me/profile", "put", {"goal": []}),
        ("/api/me/preferences", "patch", {"replyLength": {}}),
        ("/api/me/preferences", "patch", {"showTranslations": "true"}),
        ("/api/me/preferences", "patch", {"dailyGoalMinutes": True}),
        ("/api/auth/login", "post", {"email": {}, "password": []}),
        ("/api/auth/password-reset", "post", {"email": []}),
        ("/api/auth/password-reset/confirm", "post", {"token": {}}),
        ("/api/conversations", "post", {"topicId": []}),
    ],
)
def test_malformed_field_types_return_validation_errors(
    audit_accounts, path, method, payload
):
    owner, _ = audit_accounts
    response = getattr(owner["client"], method)(path, json=payload)
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] in {"VALIDATION", "RESET_TOKEN_INVALID"}


@pytest.mark.parametrize("text", [[], {}, None, True, 5])
def test_chat_rejects_non_text_without_recording_a_turn(audit_accounts, text):
    owner, _ = audit_accounts
    client = owner["client"]
    conversation_id = start_conversation(client)
    response = client.post(
        f"/api/conversations/{conversation_id}/messages", json={"text": text}
    )
    assert response.status_code == 400
    conversation = client.get(f"/api/conversations/{conversation_id}").get_json()
    assert conversation["messageCount"] == 0
    assert len(conversation["messages"]) == 1


def test_database_exception_response_and_logs_do_not_disclose_details(
    audit_accounts, audit_app, monkeypatch, caplog
):
    owner, _ = audit_accounts
    sentinel = "SYNTHETIC_SECRET_AND_SQL_SENTINEL"
    with audit_app.app_context():
        engine = db.engine

    def fail_connection(*_args, **_kwargs):
        raise OperationalError(
            "SELECT password_hash FROM users",
            {"synthetic_secret": sentinel},
            RuntimeError(sentinel),
        )

    monkeypatch.setattr(engine, "connect", fail_connection)
    response = owner["client"].get("/api/health")
    assert response.status_code == 500
    text = response.get_data(as_text=True)
    assert response.get_json()["error"]["code"] == "INTERNAL"
    for forbidden in (
        sentinel,
        "SELECT",
        "password_hash",
        "Traceback",
        "OperationalError",
    ):
        assert forbidden not in text
    assert sentinel not in caplog.text and "password_hash" not in caplog.text


def test_new_sqlite_and_instance_are_private_with_permissive_umask(request):
    # This must not depend on the launching user's otherwise permissive umask.
    previous = os.umask(0o022)
    try:
        application = request.getfixturevalue("audit_app")
    finally:
        os.umask(previous)
    with application.app_context():
        database_path = Path(db.engine.url.database)
    assert stat.S_IMODE(database_path.stat().st_mode) == 0o600
    assert stat.S_IMODE(Path(application.instance_path).stat().st_mode) == 0o700


def test_existing_sqlite_permissions_and_data_are_preserved(audit_app):
    # Only alter the synthetic files owned by this test. Existing deployment
    # permissions remain an explicit operator decision, even when permissive.
    with audit_app.app_context():
        database_path = Path(db.engine.url.database)
        db.session.add(
            User(
                id="synthetic-existing-user",
                name="Existing Synthetic Record",
                email="existing-synthetic@example.test",
                password_hash="synthetic-placeholder",
                role="user",
                session_version=4,
                created_at="2020-01-01T00:00:00.000Z",
                terms_accepted_at="2020-01-01T00:00:00.000Z",
            )
        )
        db.session.commit()
        inode = database_path.stat().st_ino
        database_path.chmod(0o644)
        Path(audit_app.instance_path).chmod(0o755)
        initialize_database(audit_app)
        assert database_path.stat().st_ino == inode
        assert stat.S_IMODE(database_path.stat().st_mode) == 0o644
        assert stat.S_IMODE(Path(audit_app.instance_path).stat().st_mode) == 0o755
    restarted = application_module.create_app()
    try:
        with restarted.app_context():
            existing = db.session.get(User, "synthetic-existing-user")
            assert existing.name == "Existing Synthetic Record"
            assert existing.session_version == 4
            assert db.session.query(User).count() == 1
            assert database_path.stat().st_ino == inode
            assert stat.S_IMODE(database_path.stat().st_mode) == 0o644
            assert stat.S_IMODE(Path(restarted.instance_path).stat().st_mode) == 0o755
    finally:
        with restarted.app_context():
            db.session.remove()
            db.engine.dispose()
