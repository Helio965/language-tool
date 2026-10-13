"""Bounded pre-provider leases on temporary SQLite; no external calls."""

from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from threading import Event

import pytest
from sqlalchemy import event, inspect, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from ai.conversation import DemoAIService
from ai.provider import ProviderError
from extensions import db
from models import Conversation, Message
from services import conversacao
from services.common import AppError, iso


def start(account):
    response = account["client"].post(
        "/api/conversations", json={"topicId": "introductions"}
    )
    assert response.status_code == 201
    return response.get_json()["id"]


def post(account, conversation_id, text="I live in Recife.", key="synthetic-turn"):
    headers = {"Idempotency-Key": key} if key is not None else {}
    return account["client"].post(
        f"/api/conversations/{conversation_id}/messages",
        json={"text": text},
        headers=headers,
    )


def service_send(application, account, conversation_id, key="synthetic-turn"):
    with application.app_context():
        try:
            return conversacao.send(
                account["user_id"], conversation_id, "I live in Recife.", key
            )
        except AppError as exc:
            return exc


@contextmanager
def pending(application, monkeypatch, account, conversation_id, key="synthetic-turn"):
    entered, release = Event(), Event()
    calls = []
    demo = DemoAIService()

    def provider(data):
        calls.append(1)
        entered.set()
        assert release.wait(timeout=10)
        return demo.conversation(data)

    monkeypatch.setattr(application.extensions["english_ai"], "conversation", provider)
    with ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(
            service_send, application, account, conversation_id, key
        )
        try:
            assert entered.wait(timeout=10)
            yield future, calls
        finally:
            release.set()


def assert_no_pending(application, conversation_id):
    with application.app_context():
        stored = db.session.get(Conversation, conversation_id)
        assert stored.pending_request_nonce is None
        assert stored.pending_request_expires_at is None


@pytest.mark.parametrize(
    ("first_key", "second_key", "text"),
    [
        ("synthetic-turn", "synthetic-turn", "I live in Recife."),
        ("synthetic-turn", "another-turn", "I live in Salvador."),
        (None, None, "I live in Recife."),
    ],
)
def test_inflight_turn_blocks_same_other_and_missing_keys_before_second_provider_call(
    audit_app, audit_accounts, monkeypatch, first_key, second_key, text
):
    account = audit_accounts[0]
    conversation_id = start(account)
    with pending(audit_app, monkeypatch, account, conversation_id, first_key) as (
        future,
        calls,
    ):
        denied = post(account, conversation_id, text, second_key)
        assert denied.status_code == 409
        assert denied.get_json()["error"]["code"] == "CONVERSATION_BUSY"
        assert calls == [1]
        assert not future.done()
    original = future.result(timeout=10)
    assert not isinstance(original, AppError)
    if first_key is not None:
        assert post(account, conversation_id, key=first_key).get_json() == original
        assert calls == [1]
    assert_no_pending(audit_app, conversation_id)


def test_pending_lease_is_private_and_bounded_to_configured_io_timeout_plus_margin(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    conversation_id = start(account)
    clock = datetime(2026, 1, 1, tzinfo=timezone.utc)
    audit_app.config.update(NOW=lambda: clock, AI_TIMEOUT_MS=120000)
    with pending(audit_app, monkeypatch, account, conversation_id) as (_future, _calls):
        with audit_app.app_context():
            stored = db.session.get(Conversation, conversation_id)
            assert len(stored.pending_request_nonce) == 36
            assert stored.pending_request_expires_at == iso(
                clock + timedelta(seconds=150)
            )
            assert not any(key.startswith("pendingRequest") for key in stored.to_dict())
        response = account["client"].get(f"/api/conversations/{conversation_id}")
        assert response.status_code == 200
        assert "pendingRequest" not in response.get_data(as_text=True)
    assert_no_pending(audit_app, conversation_id)


def test_another_conversation_can_commit_while_provider_is_blocked(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    first_id, second_id = start(account), start(account)
    with pending(audit_app, monkeypatch, account, first_id) as (future, _calls):
        # A separate Session can acquire SQLite's writer and commit immediately:
        # the pending provider request holds neither a global write transaction
        # nor an uncommitted lease. Use the same service path on another thread.
        monkeypatch.setattr(
            audit_app.extensions["english_ai"],
            "conversation",
            DemoAIService().conversation,
        )
        with ThreadPoolExecutor(max_workers=1) as executor:
            other = executor.submit(service_send, audit_app, account, second_id)
            result = other.result(timeout=5)
        assert not isinstance(result, AppError)
        assert not future.done()
        with audit_app.app_context():
            assert db.session.get(Conversation, second_id).user_message_count == 1
            assert db.session.get(Conversation, first_id).user_message_count == 0
    assert_no_pending(audit_app, first_id)
    assert_no_pending(audit_app, second_id)


def test_failed_provider_releases_lease_for_retry_without_half_turn(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    conversation_id = start(account)

    def failure(_data):
        raise ProviderError("timeout")

    monkeypatch.setattr(audit_app.extensions["english_ai"], "conversation", failure)
    assert post(account, conversation_id).status_code == 503
    assert_no_pending(audit_app, conversation_id)
    with audit_app.app_context():
        assert db.session.get(Conversation, conversation_id).user_message_count == 0
        assert (
            len(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == conversation_id)
                ).all()
            )
            == 1
        )
    monkeypatch.setattr(
        audit_app.extensions["english_ai"], "conversation", DemoAIService().conversation
    )
    assert post(account, conversation_id).status_code == 201
    assert_no_pending(audit_app, conversation_id)


def test_expired_lease_can_be_replaced_and_old_response_cannot_write_or_release_new_lease(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    conversation_id = start(account)
    clock = datetime(2026, 1, 1, tzinfo=timezone.utc)
    audit_app.config.update(NOW=lambda: clock, AI_TIMEOUT_MS=1000)
    with pending(audit_app, monkeypatch, account, conversation_id) as (future, calls):
        clock += timedelta(seconds=32)
        with audit_app.app_context():
            replacement = conversacao._claim_turn(
                account["user_id"], conversation_id, 0
            )
            stored = db.session.get(Conversation, conversation_id)
            assert stored.pending_request_nonce == replacement
    stale = future.result(timeout=10)
    assert isinstance(stale, AppError)
    assert stale.status == 409
    assert calls == [1]
    with audit_app.app_context():
        stored = db.session.get(Conversation, conversation_id)
        assert stored.user_message_count == 0
        assert stored.pending_request_nonce == replacement
        assert (
            len(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == conversation_id)
                ).all()
            )
            == 1
        )
        conversacao._release_turn(account["user_id"], conversation_id, replacement)
    assert_no_pending(audit_app, conversation_id)


def test_expired_lease_rejects_late_provider_result_even_without_replacement(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    conversation_id = start(account)
    clock = datetime(2026, 1, 1, tzinfo=timezone.utc)
    audit_app.config.update(NOW=lambda: clock, AI_TIMEOUT_MS=1000)
    with pending(audit_app, monkeypatch, account, conversation_id) as (future, _calls):
        clock += timedelta(seconds=32)
    stale = future.result(timeout=10)
    assert isinstance(stale, AppError)
    assert stale.status == 409
    assert_no_pending(audit_app, conversation_id)
    with audit_app.app_context():
        assert db.session.get(Conversation, conversation_id).user_message_count == 0


@pytest.mark.parametrize("removal", ["end", "delete", "expiry", "all"])
def test_privacy_and_end_clear_lease_and_cannot_be_undone_by_inflight_result(
    audit_app, audit_accounts, monkeypatch, removal
):
    account = audit_accounts[0]
    conversation_id = start(account)
    with pending(audit_app, monkeypatch, account, conversation_id) as (future, _calls):
        if removal == "end":
            assert (
                account["client"]
                .post(f"/api/conversations/{conversation_id}/end")
                .status_code
                == 200
            )
        elif removal == "delete":
            assert (
                account["client"]
                .delete(f"/api/conversations/{conversation_id}")
                .status_code
                == 204
            )
        elif removal == "all":
            assert account["client"].delete("/api/conversations").status_code == 200
        else:
            with audit_app.app_context(), Session(db.engine) as session:
                stored = session.get(Conversation, conversation_id)
                stored.expires_at = "2000-01-01T00:00:00.000Z"
                session.commit()
            assert (
                account["client"]
                .get(f"/api/conversations/{conversation_id}")
                .status_code
                == 200
            )
        assert_no_pending(audit_app, conversation_id)
    stale = future.result(timeout=10)
    assert isinstance(stale, AppError)
    assert stale.status == 409
    with audit_app.app_context():
        stored = db.session.get(Conversation, conversation_id)
        assert stored.user_message_count == 0
        assert stored.ended_at is not None
        assert not db.session.scalars(
            select(Message).where(
                Message.conversation_id == conversation_id, Message.role == "user"
            )
        ).all()


def test_other_account_cannot_claim_owned_conversation_or_call_provider(
    audit_app, audit_accounts, monkeypatch
):
    account, other = audit_accounts
    conversation_id = start(account)

    def unexpected(_data):
        pytest.fail("Unauthorized requests must never call the provider")

    monkeypatch.setattr(audit_app.extensions["english_ai"], "conversation", unexpected)
    assert post(other, conversation_id).status_code == 404
    assert_no_pending(audit_app, conversation_id)


def test_failed_claim_does_not_call_provider_or_leave_a_pending_lease(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    conversation_id = start(account)

    def unexpected(_data):
        pytest.fail("Failed database reservation must never call the provider")

    def fail_claim(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("UPDATE conversations SET pending_request_nonce"):
            raise SQLAlchemyError("Synthetic reservation failure")

    monkeypatch.setattr(audit_app.extensions["english_ai"], "conversation", unexpected)
    with audit_app.app_context():
        engine = db.engine
    event.listen(engine, "before_cursor_execute", fail_claim)
    try:
        response = post(account, conversation_id)
        assert response.status_code == 503
        assert response.get_json()["error"]["code"] == "PERSISTENCE_FAILED"
    finally:
        event.remove(engine, "before_cursor_execute", fail_claim)
    assert_no_pending(audit_app, conversation_id)
    with audit_app.app_context():
        assert db.session.get(Conversation, conversation_id).user_message_count == 0


def test_failed_final_commit_releases_lease_and_rolls_back_messages_and_counter(
    audit_app, audit_accounts, monkeypatch
):
    account = audit_accounts[0]
    conversation_id = start(account)
    original_commit = db.session.commit

    def failed_commit():
        db.session.flush()
        raise SQLAlchemyError("Synthetic final commit failure")

    monkeypatch.setattr(db.session, "commit", failed_commit)
    response = post(account, conversation_id)
    assert response.status_code == 503
    assert response.get_json()["error"]["code"] == "PERSISTENCE_FAILED"
    monkeypatch.setattr(db.session, "commit", original_commit)
    assert_no_pending(audit_app, conversation_id)
    with audit_app.app_context():
        assert db.session.get(Conversation, conversation_id).user_message_count == 0
        assert (
            len(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == conversation_id)
                ).all()
            )
            == 1
        )
    assert post(account, conversation_id).status_code == 201


@pytest.mark.parametrize("operation", ["end", "remove"])
def test_end_and_delete_clear_lease_even_when_identity_map_precedes_lease_commit(
    audit_app, audit_accounts, operation
):
    account = audit_accounts[0]
    conversation_id = start(account)
    with audit_app.app_context():
        # A request can read this object immediately before another request's
        # separate Session commits a lease. None -> None ORM assignments alone
        # would not include these fields in its subsequent UPDATE.
        cached = db.session.get(Conversation, conversation_id)
        assert cached.pending_request_nonce is None
        nonce = conversacao._claim_turn(account["user_id"], conversation_id, 0)
        assert cached.pending_request_nonce is None
        with Session(db.engine) as fresh:
            assert (
                fresh.get(Conversation, conversation_id).pending_request_nonce == nonce
            )
        getattr(conversacao, operation)(account["user_id"], conversation_id)
        with Session(db.engine) as fresh:
            stored = fresh.get(Conversation, conversation_id)
            assert stored.pending_request_nonce is None
            assert stored.pending_request_expires_at is None


def test_partial_claim_migration_resumes_without_recreating_tables(tmp_path):
    from flask_migrate import upgrade
    from models.migration import ROOT, initialize_database
    from test_migrations import migration_app

    application = migration_app(tmp_path / "synthetic-migration.db")
    with application.app_context():
        upgrade(
            directory=str(ROOT / "migrations"),
            revision="0003_conversation_idempotency",
        )
        with db.engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE conversations ADD COLUMN pending_request_nonce VARCHAR(36)"
            )
        initialize_database(application)
        columns = {
            column["name"] for column in inspect(db.engine).get_columns("conversations")
        }
        assert {"pending_request_nonce", "pending_request_expires_at"} <= columns
        assert len(inspect(db.engine).get_table_names()) == 15  # 14 tables + Alembic
        assert (
            db.session.execute(
                db.text("SELECT version_num FROM alembic_version")
            ).scalar()
            == "0004_conversation_claim"
        )
        db.session.remove()
        db.engine.dispose()
