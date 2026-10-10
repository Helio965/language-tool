"""Discard a real committed HTTP reply, then retry through the composer."""

from playwright.sync_api import expect
from sqlalchemy import select

from extensions import db
from models import Conversation, Message
from test_journeys import beginner, web
from test_ui_recovery import recovery_page

import pytest

pytestmark = pytest.mark.browser


def test_chat_retries_lost_committed_reply_with_same_key_then_allows_repeated_text(
    recovery_page, web, monkeypatch
):
    page = recovery_page
    beginner(page)
    page.goto("/conversar")
    page.locator("#topic-introductions").click()
    expect(page.locator("#chat-form")).to_be_visible()
    conversation_id = page.url.rsplit("/", 1)[-1]
    service = web["app"].extensions["english_ai"]
    provider_calls = []
    original = service.conversation

    def counted_provider(data):
        provider_calls.append(data["userMessage"])
        return original(data)

    monkeypatch.setattr(service, "conversation", counted_provider)
    attempts = []

    def lose_first_reply(route):
        attempts.append(route.request.headers["idempotency-key"])
        if len(attempts) == 1:
            response = route.fetch()
            assert response.status == 201
            route.abort("connectionfailed")
        else:
            route.continue_()

    page.route("**/api/conversations/*/messages", lose_first_reply)
    page.locator("#chat-input").fill("I live in Recife.")
    page.locator("#chat-send").click()
    expect(page.locator("#chat-error")).to_be_visible()
    expect(page.locator("#chat-input")).to_have_value("I live in Recife.")
    page.locator("#chat-send").click()
    expect(page.locator("#chat-message-count")).to_have_text("1")
    assert attempts[0] == attempts[1]
    assert provider_calls == ["I live in Recife."]
    with web["app"].app_context():
        assert db.session.get(Conversation, conversation_id).user_message_count == 1
        assert (
            len(
                list(
                    db.session.scalars(
                        select(Message).where(
                            Message.conversation_id == conversation_id
                        )
                    )
                )
            )
            == 3
        )

    # An intentional new send after confirmation receives a different identity.
    page.locator("#chat-input").fill("I live in Recife.")
    page.locator("#chat-send").click()
    expect(page.locator("#chat-message-count")).to_have_text("2")
    assert attempts[2] != attempts[1]
    assert provider_calls == ["I live in Recife.", "I live in Recife."]
    page.reload()
    expect(page.locator("#chat-message-count")).to_have_text("2")
