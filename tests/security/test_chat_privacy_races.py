"""Privacy/account changes during simulated provider I/O on temporary SQLite."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import json
from threading import Event

import pytest
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ai.conversation import DemoAIService
from extensions import db
from models import Conversation, Message, Preferences, User
from services import conversacao
from services.common import iso


def start(account):
    response = account["client"].post(
        "/api/conversations", json={"topicId": "introductions"}
    )
    assert response.status_code == 201
    return response.get_json()["id"]


def snapshot(user_id):
    """Compare every private table without exposing row values in assertions."""
    result = {}
    for table in db.metadata.sorted_tables:
        statement = select(table)
        if table.name == "users":
            statement = statement.where(table.c.id == user_id)
        elif table.name == "messages":
            statement = statement.join(Conversation).where(
                Conversation.user_id == user_id
            )
        elif "user_id" in table.c:
            statement = statement.where(table.c.user_id == user_id)
        else:
            continue
        result[table.name] = tuple(
            sorted(
                hashlib.sha256(
                    json.dumps(dict(row), sort_keys=True).encode()
                ).hexdigest()
                for row in db.session.execute(statement).mappings()
            )
        )
    return result


@contextmanager
def pending_http(
    application, account, client_factory, monkeypatch, operation, conversation_id=None
):
    """Block only the local provider while an independently signed request runs."""
    client = client_factory()
    cookie_name = application.config["SESSION_COOKIE_NAME"]
    client.client.set_cookie(
        cookie_name, account["client"].client.get_cookie(cookie_name).value
    )
    entered, release = Event(), Event()
    calls = []
    demo = DemoAIService()
    method = "start_conversation" if operation == "start" else "conversation"

    def provider(data):
        calls.append(1)
        entered.set()
        assert release.wait(timeout=10)
        return getattr(demo, method)(data)

    monkeypatch.setattr(application.extensions["english_ai"], method, provider)

    def request():
        if operation == "start":
            return client.post("/api/conversations", json={"topicId": "introductions"})
        return client.post(
            f"/api/conversations/{conversation_id}/messages",
            json={"text": "I live in Recife."},
            headers={"Idempotency-Key": "synthetic-privacy-turn"},
        )

    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(request)
        try:
            assert entered.wait(timeout=10)
            yield future, calls
        finally:
            release.set()


@pytest.mark.parametrize("operation", ["start", "send"])
def test_account_deleted_during_provider_returns_safe_401_without_resurrection(
    audit_app, audit_accounts, audit_client_factory, monkeypatch, operation
):
    account, other = audit_accounts
    conversation_id = start(account) if operation == "send" else None
    other_id = start(other)
    with audit_app.app_context():
        other_before = snapshot(other["user_id"])
    with pending_http(
        audit_app, account, audit_client_factory, monkeypatch, operation, conversation_id
    ) as (future, calls):
        deleted = account["client"].delete(
            "/api/me", json={"password": "SyntheticAudit2026"}
        )
        assert deleted.status_code == 204
        assert not future.done()
    response = future.result(timeout=10)
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "UNAUTHENTICATED"
    assert "assistantMessage" not in response.get_json()
    assert calls == [1]
    with audit_app.app_context():
        assert all(not digests for digests in snapshot(account["user_id"]).values())
        assert snapshot(other["user_id"]) == other_before
    assert other["client"].get(f"/api/conversations/{other_id}").status_code == 200


@pytest.mark.parametrize("initial_expiry", ["saved", "soon", "none"])
@pytest.mark.parametrize("reenable", [False, True])
def test_inflight_reply_preserves_earliest_privacy_deadline_and_replay(
    audit_app,
    audit_accounts,
    audit_client_factory,
    monkeypatch,
    initial_expiry,
    reenable,
):
    account, other = audit_accounts
    clock = datetime(2026, 1, 1, tzinfo=timezone.utc)
    audit_app.config["NOW"] = lambda: clock
    conversation_id = start(account)
    start(other)
    with audit_app.app_context():
        if initial_expiry != "saved":
            stored = db.session.get(Conversation, conversation_id)
            stored.expires_at = (
                iso(clock + timedelta(seconds=30)) if initial_expiry == "soon" else None
            )
            db.session.commit()
        other_before = snapshot(other["user_id"])
    with pending_http(
        audit_app, account, audit_client_factory, monkeypatch, "send", conversation_id
    ) as (future, calls):
        clock += timedelta(seconds=10)
        assert (
            account["client"]
            .patch("/api/me/preferences", json={"saveConversationHistory": False})
            .status_code
            == 200
        )
        with audit_app.app_context():
            shortened = db.session.get(Conversation, conversation_id).expires_at
        if reenable:
            assert (
                account["client"]
                .patch("/api/me/preferences", json={"saveConversationHistory": True})
                .status_code
                == 200
            )
        clock += timedelta(seconds=10)
    response = future.result(timeout=10)
    assert response.status_code == 201
    assert calls == [1]
    with audit_app.app_context():
        stored = db.session.get(Conversation, conversation_id)
        assert stored.retention == "ephemeral"
        assert stored.expires_at == shortened
        assert stored.user_message_count == 1
        assert stored.pending_request_nonce is None
        assert stored.pending_request_expires_at is None
        assert snapshot(other["user_id"]) == other_before
    replay = account["client"].post(
        f"/api/conversations/{conversation_id}/messages",
        json={"text": "I live in Recife."},
        headers={"Idempotency-Key": "synthetic-privacy-turn"},
    )
    assert replay.status_code == 201
    assert replay.get_json() == response.get_json()
    assert calls == [1]
    assert account["client"].get("/api/conversations").get_json() == []


def test_stale_reply_cannot_extend_privacy_deadline_or_clear_replacement_nonce(
    audit_app, audit_accounts, audit_client_factory, monkeypatch
):
    account, other = audit_accounts
    clock = datetime(2026, 1, 1, tzinfo=timezone.utc)
    audit_app.config.update(NOW=lambda: clock, AI_TIMEOUT_MS=1000)
    conversation_id = start(account)
    start(other)
    with audit_app.app_context():
        other_before = snapshot(other["user_id"])
    with pending_http(
        audit_app, account, audit_client_factory, monkeypatch, "send", conversation_id
    ) as (future, calls):
        clock += timedelta(seconds=10)
        assert (
            account["client"]
            .patch("/api/me/preferences", json={"saveConversationHistory": False})
            .status_code
            == 200
        )
        clock += timedelta(seconds=22)
        with audit_app.app_context():
            replacement = conversacao._claim_turn(account["user_id"], conversation_id, 0)
            before = snapshot(account["user_id"])
    response = future.result(timeout=10)
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "CONVERSATION_CHANGED"
    assert calls == [1]
    with audit_app.app_context():
        assert snapshot(account["user_id"]) == before
        assert snapshot(other["user_id"]) == other_before
        stored = db.session.get(Conversation, conversation_id)
        assert stored.pending_request_nonce == replacement
        assert stored.user_message_count == 0
        conversacao._release_turn(account["user_id"], conversation_id, replacement)


@pytest.mark.parametrize("operation", ["start", "send"])
def test_missing_preferences_during_provider_returns_409_without_default_repair(
    audit_app, audit_accounts, audit_client_factory, monkeypatch, operation
):
    account, other = audit_accounts
    conversation_id = start(account) if operation == "send" else None
    start(other)
    with audit_app.app_context():
        other_before = snapshot(other["user_id"])
    with pending_http(
        audit_app, account, audit_client_factory, monkeypatch, operation, conversation_id
    ) as (future, calls):
        with audit_app.app_context(), Session(db.engine) as independent:
            independent.execute(
                delete(Preferences).where(Preferences.user_id == account["user_id"])
            )
            independent.commit()
    response = future.result(timeout=10)
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "INCOMPLETE_ACCOUNT"
    assert calls == [1]
    with audit_app.app_context():
        assert db.session.get(User, account["user_id"]) is not None
        assert db.session.get(Preferences, account["user_id"]) is None
        assert snapshot(other["user_id"]) == other_before
        conversations = db.session.scalars(
            select(Conversation).where(Conversation.user_id == account["user_id"])
        ).all()
        assert len(conversations) == (1 if operation == "send" else 0)
        if operation == "send":
            stored = conversations[0]
            assert stored.user_message_count == 0
            assert stored.pending_request_nonce is None
            assert stored.pending_request_expires_at is None
            assert len(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == stored.id)
                ).all()
            ) == 1
