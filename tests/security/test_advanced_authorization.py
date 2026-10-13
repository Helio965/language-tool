"""Authorization, deletion and rollback with complete synthetic A/B records."""

import hashlib
import json

import pytest
from sqlalchemy import func, inspect, select, text

from extensions import db
from models import (
    Conversation,
    ExerciseAttempt,
    LearningProfile,
    Message,
    PasswordResetToken,
    Preferences,
    Progress,
    Review,
    User,
    UserVocabulary,
)

PRIVATE_MODELS = (
    User,
    PasswordResetToken,
    LearningProfile,
    Preferences,
    Progress,
    ExerciseAttempt,
    UserVocabulary,
    Review,
    Conversation,
    Message,
)
CATALOG_TABLES = ("lessons", "exercises", "vocabulary", "lesson_vocabulary")


def _owned_statement(model, user_id):
    table = model.__table__
    if model is User:
        return select(table).where(table.c.id == user_id)
    if model is Message:
        return select(table).join(Conversation).where(Conversation.user_id == user_id)
    return select(table).where(table.c.user_id == user_id)


def _digest_rows(statement):
    # Assertions compare digests; private fields are never included in reports.
    rows = list(db.session.execute(statement).mappings())
    digests = sorted(
        hashlib.sha256(json.dumps(dict(row), sort_keys=True).encode()).hexdigest()
        for row in rows
    )
    return len(rows), tuple(digests)


def _private_snapshot(user_id):
    return {
        model.__tablename__: _digest_rows(_owned_statement(model, user_id))
        for model in PRIVATE_MODELS
    }


def _catalog_snapshot():
    return {
        name: _digest_rows(select(db.metadata.tables[name])) for name in CATALOG_TABLES
    }


@pytest.fixture
def full_accounts(audit_accounts, audit_app):
    """Populate every private table for two fake users through protected APIs."""
    for index, account in enumerate(audit_accounts):
        client = account["client"]
        assert client.post("/api/lessons/greetings/start").status_code == 204
        answer = f"Synthetic private answer account {index}"
        response = client.post(
            "/api/lessons/greetings/exercises/greetings-1/answer",
            headers={"Idempotency-Key": f"synthetic-answer-{index}"},
            json={"answer": answer},
        )
        assert response.status_code == 200
        assert (
            client.put(
                "/api/vocabulary/red/status", json={"status": "learning"}
            ).status_code
            == 200
        )
        conversation = client.post(
            "/api/conversations", json={"topicId": "introductions"}
        )
        assert conversation.status_code == 201
        account["conversation_id"] = conversation.get_json()["id"]
        assert (
            client.post(
                f"/api/conversations/{account['conversation_id']}/messages",
                json={"text": f"My synthetic study detail belongs to account {index}."},
            ).status_code
            == 201
        )
        assert (
            client.post(
                "/api/auth/password-reset", json={"email": account["email"]}
            ).status_code
            == 202
        )
        with audit_app.app_context():
            review = Review(
                id=f"synthetic-full-review-{index}",
                user_id=account["user_id"],
                kind="lesson",
                ref_id="greetings",
                reason="low_score",
                status="pending",
                due_at="2020-01-01T00:00:00.000Z",
                created_at="2020-01-01T00:00:00.000Z",
            )
            db.session.add(review)
            db.session.commit()
            account["review_id"] = review.id
            assert all(
                count > 0 for count, _ in _private_snapshot(account["user_id"]).values()
            )
    return audit_accounts


def test_account_delete_removes_all_private_tables_preserves_b_and_catalog(
    full_accounts, audit_app, audit_client_factory
):
    first, second = full_accounts
    with audit_app.app_context():
        assert set(CATALOG_TABLES) | {m.__tablename__ for m in PRIVATE_MODELS} <= set(
            inspect(db.engine).get_table_names()
        )
        first_before = _private_snapshot(first["user_id"])
        second_before = _private_snapshot(second["user_id"])
        catalog_before = _catalog_snapshot()
        assert db.session.execute(text("PRAGMA foreign_keys")).scalar() == 1
    copy = audit_client_factory()
    name = audit_app.config["SESSION_COOKIE_NAME"]
    copy.client.set_cookie(name, first["client"].client.get_cookie(name).value)
    assert copy.get("/api/me").status_code == 200
    assert (
        audit_client_factory()
        .delete("/api/me", json={"password": "SyntheticAudit2026"})
        .status_code
        == 401
    )
    assert (
        first["client"]
        .delete("/api/me", json={"password": "IncorrectSynthetic2026"})
        .status_code
        == 400
    )
    with audit_app.app_context():
        assert _private_snapshot(first["user_id"]) == first_before
        assert _private_snapshot(second["user_id"]) == second_before
    # Client identifiers cannot replace the authenticated owner of the deletion.
    response = first["client"].delete(
        "/api/me",
        json={
            "password": "SyntheticAudit2026",
            "userId": second["user_id"],
            "id": second["user_id"],
        },
    )
    assert response.status_code == 204
    assert first["client"].get("/api/me").status_code == 401
    assert copy.get("/api/me").status_code == 401
    with audit_app.app_context():
        assert all(
            count == 0 for count, _ in _private_snapshot(first["user_id"]).values()
        )
        assert _private_snapshot(second["user_id"]) == second_before
        assert _catalog_snapshot() == catalog_before
        assert db.session.execute(text("PRAGMA foreign_key_check")).first() is None
    assert second["client"].get("/api/me").get_json()["user"]["id"] == second["user_id"]
    assert (
        second["client"]
        .get(f"/api/conversations/{second['conversation_id']}")
        .status_code
        == 200
    )


def test_account_delete_commit_failure_rolls_back_every_private_table(
    full_accounts, audit_app, monkeypatch
):
    first, second = full_accounts
    with audit_app.app_context():
        before = [_private_snapshot(item["user_id"]) for item in full_accounts]
        catalog_before = _catalog_snapshot()

    def fail_commit():
        raise RuntimeError("Synthetic commit failure contains private diagnostic SQL")

    with monkeypatch.context() as commit_patch:
        commit_patch.setattr(db.session, "commit", fail_commit)
        response = first["client"].delete(
            "/api/me", json={"password": "SyntheticAudit2026"}
        )
    assert response.status_code == 500
    assert response.get_json()["error"]["code"] == "INTERNAL"
    assert "private diagnostic" not in response.get_data(as_text=True)
    with audit_app.app_context():
        assert [_private_snapshot(item["user_id"]) for item in full_accounts] == before
        assert _catalog_snapshot() == catalog_before
        assert db.session.execute(text("PRAGMA foreign_key_check")).first() is None
    assert first["client"].get("/api/me").status_code == 200
    assert second["client"].get("/api/me").status_code == 200


@pytest.mark.parametrize(
    "method, resource, suffix, payload",
    [
        ("GET", "conversation_id", "", None),
        ("POST", "conversation_id", "/messages", {"text": "Hello"}),
        ("POST", "conversation_id", "/end", {}),
        ("DELETE", "conversation_id", "", None),
        ("POST", "review_id", "/session", {}),
        (
            "POST",
            "review_id",
            "/answers",
            {"exerciseId": "greetings-1", "answer": "Hello"},
        ),
        ("POST", "review_id", "/complete", {"score": 100}),
    ],
)
def test_private_resource_errors_do_not_distinguish_foreign_and_missing_ids(
    full_accounts, audit_app, method, resource, suffix, payload
):
    first, second = full_accounts
    route = "conversations" if resource == "conversation_id" else "reviews"
    with audit_app.app_context():
        before = _private_snapshot(first["user_id"])
    options = {"json": payload} if payload is not None else {}
    foreign = second["client"].open(
        f"/api/{route}/{first[resource]}{suffix}", method, **options
    )
    missing = second["client"].open(
        f"/api/{route}/synthetic-nonexistent-resource{suffix}", method, **options
    )
    assert foreign.status_code == missing.status_code == 404
    assert foreign.get_json() == missing.get_json()
    assert first["user_id"] not in foreign.get_data(as_text=True)
    with audit_app.app_context():
        assert _private_snapshot(first["user_id"]) == before


def test_progress_attempt_and_vocabulary_identifiers_cannot_select_other_owner(
    full_accounts, audit_app
):
    first, second = full_accounts
    with audit_app.app_context():
        before = _private_snapshot(first["user_id"])
        passage = db.session.get(Progress, (first["user_id"], "greetings")).passage_id
    query = {"userId": first["user_id"], "passageId": passage, "role": "admin"}
    for path in (
        "/api/progress",
        "/api/home",
        "/api/lessons/greetings",
        "/api/vocabulary",
        "/api/reviews",
        "/api/conversations",
    ):
        response = second["client"].get(path, query_string=query)
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        assert first["user_id"] not in body
        assert "Synthetic private answer account 0" not in body
        assert first["conversation_id"] not in body
        assert first["review_id"] not in body
    response = second["client"].post(
        "/api/lessons/greetings/exercises/greetings-1/answer",
        headers={"Idempotency-Key": "synthetic-answer-0"},
        json={
            "answer": "Synthetic independent answer account B",
            "userId": first["user_id"],
            "passageId": passage,
        },
    )
    assert response.status_code == 200
    assert response.get_json()["userAnswer"] == "Synthetic independent answer account B"
    assert (
        second["client"]
        .post(
            "/api/lessons/greetings/complete",
            json={"userId": first["user_id"], "score": 100},
        )
        .status_code
        == 409
    )
    assert (
        second["client"]
        .put(
            "/api/vocabulary/red/status",
            json={"userId": first["user_id"], "status": "learned"},
        )
        .status_code
        == 200
    )
    with audit_app.app_context():
        assert _private_snapshot(first["user_id"]) == before
        assert (
            db.session.get(UserVocabulary, (second["user_id"], "red")).status
            == "learned"
        )
        assert (
            db.session.scalar(
                select(func.count())
                .select_from(ExerciseAttempt)
                .where(ExerciseAttempt.user_id == second["user_id"])
            )
            == 2
        )


PRIVATE_HTTP_ROUTES = (
    ("GET", "/api/me"),
    ("DELETE", "/api/me"),
    ("PUT", "/api/me/profile"),
    ("GET", "/api/me/preferences"),
    ("PATCH", "/api/me/preferences"),
    ("GET", "/api/home"),
    ("GET", "/api/progress"),
    ("POST", "/api/placement/start"),
    ("POST", "/api/placement/answers"),
    ("POST", "/api/placement/skip"),
    ("GET", "/api/lessons"),
    ("GET", "/api/lessons/greetings"),
    ("POST", "/api/lessons/greetings/start"),
    ("POST", "/api/lessons/greetings/exercises/greetings-1/answer"),
    ("POST", "/api/lessons/greetings/complete"),
    ("POST", "/api/lessons/greetings/explain"),
    ("POST", "/api/lessons/greetings/example"),
    ("GET", "/api/vocabulary"),
    ("GET", "/api/vocabulary/red"),
    ("PUT", "/api/vocabulary/red/status"),
    ("GET", "/api/reviews"),
    ("POST", "/api/reviews/{review_id}/session"),
    ("POST", "/api/reviews/{review_id}/answers"),
    ("POST", "/api/reviews/{review_id}/complete"),
    ("GET", "/api/conversation-topics"),
    ("GET", "/api/conversations"),
    ("POST", "/api/conversations"),
    ("DELETE", "/api/conversations"),
    ("GET", "/api/conversations/{conversation_id}"),
    ("POST", "/api/conversations/{conversation_id}/messages"),
    ("POST", "/api/conversations/{conversation_id}/end"),
    ("DELETE", "/api/conversations/{conversation_id}"),
)


@pytest.mark.parametrize("state", ["anonymous", "tampered", "revoked"])
def test_every_private_api_rejects_anonymous_tampered_and_revoked_sessions(
    full_accounts, audit_app, audit_client_factory, state
):
    first, second = full_accounts
    outsider = audit_client_factory()
    name = audit_app.config["SESSION_COOKIE_NAME"]
    cookie = first["client"].client.get_cookie(name).value
    tampered_cookie = None
    original_csrf = None
    if state == "tampered":
        payload, signature = cookie.rsplit(".", 1)
        signature = ("A" if signature[0] != "A" else "B") + signature[1:]
        tampered_cookie = payload + "." + signature
        original_csrf = first["client"].get("/api/csrf").get_json()["csrfToken"]
    elif state == "revoked":
        outsider.client.set_cookie(name, cookie)
        assert first["client"].post("/api/auth/logout").status_code == 204
    with audit_app.app_context():
        before = [_private_snapshot(item["user_id"]) for item in full_accounts]
    for method, route in PRIVATE_HTTP_ROUTES:
        route = route.format(**first)
        options = (
            {"json": {"password": "SyntheticAudit2026", "userId": first["user_id"]}}
            if method != "GET"
            else {}
        )
        expected_code, expected_status = "UNAUTHENTICATED", 401
        if tampered_cookie:
            # Reapply the altered signature for every route. A CSRF bootstrap
            # would otherwise replace it with a new anonymous signed cookie.
            outsider.client.set_cookie(name, tampered_cookie)
            if method != "GET":
                options.update(csrf=False, headers={"X-CSRFToken": original_csrf})
                expected_code, expected_status = "CSRF", 400
        response = outsider.open(route, method, **options)
        assert response.status_code == expected_status, (state, method, route)
        assert response.get_json()["error"]["code"] == expected_code
        assert first["user_id"] not in response.get_data(as_text=True)
    with audit_app.app_context():
        assert [_private_snapshot(item["user_id"]) for item in full_accounts] == before
    assert second["client"].get("/api/me").status_code == 200
