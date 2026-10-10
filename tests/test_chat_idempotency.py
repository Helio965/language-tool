"""A lost HTTP reply must not charge, count or store the same turn twice."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest
from sqlalchemy import select

from ai.conversation import DemoAIService
from ai.provider import ProviderError
from extensions import db
from models import Conversation, Message
from services import conversacao
from test_ai import register, start


def send(client, conversation_id, text="I live in Recife.", key="turn-1"):
    return client.post(
        f"/api/conversations/{conversation_id}/messages",
        json={"text": text},
        headers={"Idempotency-Key": key},
    )


def test_lost_reply_retry_returns_original_pair_without_provider_or_counter_increment(
    client, app, monkeypatch
):
    register(client)
    conversation = start(client)
    first = send(client, conversation["id"])
    assert first.status_code == 201
    original = first.get_json()

    def unexpected_provider_call(_data):
        pytest.fail("A committed retry must not call the provider again")

    monkeypatch.setattr(
        app.extensions["english_ai"], "conversation", unexpected_provider_call
    )
    # The first response can be lost after COMMIT; the caller only knows its key.
    retry = send(client, conversation["id"])
    assert retry.status_code == 201
    assert retry.get_json() == original
    assert "idempotencyKey" not in original["userMessage"]
    assert "requestFingerprint" not in original["userMessage"]
    assert "replyMetadata" not in original["assistantMessage"]
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 1
        assert (
            len(
                list(
                    db.session.scalars(
                        select(Message).where(
                            Message.conversation_id == conversation["id"]
                        )
                    )
                )
            )
            == 3
        )


@pytest.mark.parametrize(
    "changed", ["I live in Salvador.", "My email is other@example.com."]
)
def test_reused_key_rejects_changed_content_even_when_both_addresses_are_redacted(
    client, app, changed
):
    register(client)
    conversation = start(client)
    assert (
        send(client, conversation["id"], "My email is alex@example.com.").status_code
        == 201
    )
    response = send(client, conversation["id"], changed)
    assert response.status_code == 409
    assert response.get_json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 1
        message = db.session.scalar(
            select(Message).where(
                Message.idempotency_key == "turn-1", Message.role == "user"
            )
        )
        assert "alex@example.com" not in message.content
        assert len(message.request_fingerprint) == 64


def test_completed_saved_conversation_can_replay_but_deleted_content_cannot(
    client, app
):
    register(client)
    conversation = start(client)
    original = send(client, conversation["id"]).get_json()
    assert (
        client.post(f"/api/conversations/{conversation['id']}/end").status_code == 200
    )
    assert send(client, conversation["id"]).get_json() == original
    assert send(client, conversation["id"], key="new-turn").status_code == 409
    assert client.delete(f"/api/conversations/{conversation['id']}").status_code == 204
    assert send(client, conversation["id"]).status_code == 409
    with app.app_context():
        assert (
            list(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == conversation["id"])
                )
            )
            == []
        )


def test_replay_is_scoped_to_owned_conversation_and_account(client, app):
    register(client)
    first = start(client)
    original = send(client, first["id"]).get_json()
    second = start(client)
    second_reply = send(client, second["id"])
    assert second_reply.status_code == 201
    assert second_reply.get_json()["userMessage"]["id"] != original["userMessage"]["id"]
    other = app.test_client()
    register(other, "other@example.com")
    denied = send(other, first["id"])
    assert denied.status_code == 404
    assert original["userMessage"]["id"] not in denied.get_data(as_text=True)
    own = start(other)
    assert send(other, own["id"]).status_code == 201


@pytest.mark.parametrize("removal", ["expiry", "ephemeral_end"])
def test_privacy_cleanup_removes_replay_metadata_as_well_as_text(client, app, removal):
    register(client)
    conversation = start(client)
    assert send(client, conversation["id"]).status_code == 201
    if removal == "expiry":
        with app.app_context():
            stored = db.session.get(Conversation, conversation["id"])
            stored.expires_at = "2000-01-01T00:00:00.000Z"
            db.session.commit()
    else:
        assert (
            client.patch(
                "/api/me/preferences", json={"saveConversationHistory": False}
            ).status_code
            == 200
        )
        assert (
            client.post(f"/api/conversations/{conversation['id']}/end").status_code
            == 200
        )
    assert send(client, conversation["id"]).status_code == 409
    with app.app_context():
        assert (
            list(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == conversation["id"])
                )
            )
            == []
        )
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 1


def test_provider_failure_does_not_reserve_key_or_persist_a_half_turn(
    client, app, monkeypatch
):
    register(client)
    conversation = start(client)
    provider = app.extensions["english_ai"]
    original = provider.conversation

    def timeout(_data):
        raise ProviderError("timeout")

    monkeypatch.setattr(provider, "conversation", timeout)
    assert send(client, conversation["id"]).status_code == 503
    monkeypatch.setattr(provider, "conversation", original)
    assert send(client, conversation["id"]).status_code == 201
    assert send(client, conversation["id"]).status_code == 201
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 1


def test_simultaneous_same_key_commits_one_pair_and_both_callers_recover_it(
    client, app, monkeypatch
):
    user_id = register(client)
    conversation = start(client)
    barrier = Barrier(2)
    demo = DemoAIService()

    def parallel_provider(data):
        barrier.wait(timeout=10)
        return demo.conversation(data)

    monkeypatch.setattr(app.extensions["english_ai"], "conversation", parallel_provider)

    def parallel_send():
        with app.app_context():
            return conversacao.send(
                user_id, conversation["id"], "I live in Recife.", "parallel-turn"
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _index: parallel_send(), range(2)))
    assert results[0] == results[1]
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 1
        assert (
            len(
                list(
                    db.session.scalars(
                        select(Message).where(
                            Message.conversation_id == conversation["id"]
                        )
                    )
                )
            )
            == 3
        )


@pytest.mark.parametrize("key", ["", "space key", "x" * 129, "bad/route"])
def test_invalid_request_keys_fail_before_provider_or_write(client, app, key):
    register(client)
    conversation = start(client)
    assert send(client, conversation["id"], key=key).status_code == 400
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 0


def test_clients_without_request_key_keep_existing_contract(client, app):
    register(client)
    conversation = start(client)
    url = f"/api/conversations/{conversation['id']}/messages"
    assert client.post(url, json={"text": "Hello."}).status_code == 201
    assert client.post(url, json={"text": "Hello."}).status_code == 201
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 2
