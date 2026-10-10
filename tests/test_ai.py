"""Real DB flows and official SDK transport checks; no paid external API calls."""

import json
from datetime import datetime, timedelta, timezone

import anthropic
import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ai.conversation import DemoAIService, empty_context, redact_sensitive_data
from ai.correction import (
    apply_issues,
    build_correction,
    check_grammar,
    decide_conversation_corrections,
)
from ai.prompts import CONVERSATION_SCHEMA, OPENING_SCHEMA, build_system_prompt
from ai.provider import (
    AnthropicProvider,
    LLMAIService,
    ProviderError,
    create_ai_service,
    validate_response,
)
from content import catalog
from extensions import db
from models import Conversation, Message, Review
from services import conversacao

LEARNER = {
    "firstName": "Alex",
    "level": "basic",
    "goal": "conversation",
    "interestAreas": ["technology"],
    "explanationLanguage": "pt",
    "correctionIntensity": "balanced",
    "replyLength": "balanced",
    "showTranslations": True,
    "difficulties": ["simple_present"],
}


def register(client, email="alex@example.com"):
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Alex Silva",
            "email": email,
            "password": "SenhaTeste123",
            "passwordConfirmation": "SenhaTeste123",
            "acceptedTerms": True,
        },
    )
    assert response.status_code == 201, response.get_json()
    return response.get_json()["user"]["id"]


def start(client, topic="introductions"):
    response = client.post("/api/conversations", json={"topicId": topic})
    assert response.status_code == 201, response.get_json()
    return response.get_json()


@pytest.mark.parametrize(
    "source,expected",
    [
        ("I have 25 years.", "I am 25 years old."),
        ("She go to school every day.", "She goes to school every day."),
        ("I didn't went there.", "I didn't go there."),
        ("I wake up at the morning.", "I wake up in the morning."),
        ("I am agree.", "I agree."),
        ("People is friendly.", "People are friendly."),
        ("I go to the gym in Monday.", "I go to the gym on Monday."),
        ("In my city have many parks.", "In my city, there are many parks."),
        ("I like play soccer.", "I like playing soccer."),
        ("He don't like it.", "He doesn't like it."),
        ("I went to home early.", "I went home early."),
        ("Can you explain me this?", "Can you explain this to me?"),
        ("How many years do you have?", "How old are you?"),
        ("i think so", "I think so"),
        ("Can I make a question?", "Can I ask a question?"),
    ],
)
def test_preserved_grammar_examples(source, expected):
    assert apply_issues(source, check_grammar(source)) == expected


@pytest.mark.parametrize(
    "text",
    [
        "Am I late?",
        "Let it go.",
        "Does it work?",
        "I have three years of experience.",
        "She goes to work.",
        "Yesterday she go to school.",
        "I'm boring today.",
        "I pretend to travel in this game.",
        "I'm 25 years younger than my brother.",
        "I have fear.",
    ],
)
def test_grammar_does_not_guess_meaning_or_flag_valid_forms(text):
    assert check_grammar(text) == []


def test_policy_preserves_natural_conversation():
    grammar = check_grammar("She go to school.")
    assert decide_conversation_corrections(grammar, "light", "basic", 5)["inline"] == []
    assert (
        decide_conversation_corrections(grammar, "balanced", "basic", 2)["inline"]
        == grammar
    )
    assert (
        decide_conversation_corrections(grammar, "balanced", "basic", 0)["deferred"]
        == grammar
    )
    assert decide_conversation_corrections(
        check_grammar("i like it"), "balanced", "beginner", 5
    )["ignored"]
    correction = build_correction("She go to school.", grammar, "pt", True)
    assert correction["suggestion"] == "She goes to school."
    assert "-s" in correction["explanation"]
    assert correction["tip"]


def test_demo_keeps_context_recasts_and_announces_mode():
    service = DemoAIService()
    topic = catalog.topic("introductions")
    opening = service.start_conversation({"learner": LEARNER, "topic": topic})
    result = service.conversation(
        {
            "learner": LEARNER,
            "topic": topic,
            "context": opening["context"],
            "history": [],
            "userMessage": "I have 25 years.",
        }
    )
    assert result["context"]["facts"]["age"] == "25"
    assert "How old are you" not in result["reply"]
    assert "you are 25 years old" in result["reply"]
    assert result["ai"]["mode"] == "demo"
    assert "roteirizadas" in result["ai"]["notice"]


def test_prompts_do_not_include_unapproved_fields():
    prompt = build_system_prompt(
        "conversation",
        dict(
            LEARNER, email="private@example.com", password="private", userId="secret-id"
        ),
    )
    assert "Lumi" in prompt
    assert "NATURALIDADE > CORREÇÃO EXCESSIVA" in prompt
    assert "private@example.com" not in prompt
    assert "secret-id" not in prompt
    assert "Peça esclarecimento" in prompt


@pytest.mark.parametrize(
    "raw",
    [
        "",
        "not json",
        "[]",
        '{"reply":"hi"}',
        '{"reply":"","translation":""}',
        '{"reply":42,"translation":""}',
        '{"reply":"hi","translation":"","extra":"x"}',
        '{"reply":"hi","reply":"hidden","translation":""}',
        json.dumps({"reply": "x" * 1201, "translation": ""}),
    ],
)
def test_invalid_provider_responses_fail_without_demo_fallback(raw):
    with pytest.raises(ProviderError) as caught:
        validate_response(raw, OPENING_SCHEMA)
    assert caught.value.reason == "invalid_response"


class RecordingProvider:
    name = "test-provider"
    model = "test-model"

    def __init__(self, result=None):
        self.requests = []
        self.result = result or {
            "reply": "Nice! What do you do?",
            "translation": "Legal! O que você faz?",
            "facts": [],
            "issues": [],
        }

    def complete(self, request):
        self.requests.append(request)
        return json.dumps(self.result)


def test_live_service_bounds_and_redacts_history_facts_and_output():
    provider = RecordingProvider(
        {
            "reply": "Nice! private@example.com",
            "translation": "Legal!",
            "facts": [
                {"key": "city", "value": "Recife"},
                {"key": "job", "value": "invented"},
                {"key": "phone", "value": "11987654321"},
            ],
            "issues": [
                {
                    "span": "imaginary",
                    "replacement": "other",
                    "severity": "grammar",
                    "skill": "word_choice",
                    "explanation_pt": "ajuste",
                    "explanation_en": "fix",
                }
            ],
        }
    )
    service = LLMAIService(provider, max_history=4, max_context_chars=1400)
    history = [
        {"role": "user", "content": "x" * 600 + " a@private.com"} for _ in range(30)
    ]
    result = service.conversation(
        {
            "learner": LEARNER,
            "topic": catalog.topic("introductions"),
            "context": dict(
                empty_context(), facts={"city": "email@private.com", "job": "teacher"}
            ),
            "history": history,
            "userMessage": "I live in Recife. She go to school.",
        }
    )
    request = provider.requests[0]
    assert len(request["messages"]) <= 5
    assert sum(len(item["content"]) for item in request["messages"]) <= 1400
    assert "private.com" not in json.dumps(request)
    assert result["context"]["facts"] == {"city": "Recife", "job": "teacher"}
    assert "private@example.com" not in result["reply"]
    assert [item["ruleId"] for item in result["issues"]] == ["third_person_s"]


def test_unconfigured_anthropic_is_not_disguised_as_demo():
    service = create_ai_service(
        {
            "AI_PROVIDER": "anthropic",
            "ANTHROPIC_MODEL": "claude-sonnet-4-5",
            "ANTHROPIC_API_KEY": "",
        }
    )
    assert service.metadata()["mode"] == "unconfigured"
    with pytest.raises(ProviderError) as caught:
        service.start_conversation({"learner": LEARNER, "topic": catalog.topic("free")})
    assert caught.value.reason == "not_configured"


@pytest.mark.parametrize(
    "message,replacement",
    [
        ("I'm boring today.", "I'm bored today."),
        ("I pretend to travel.", "I intend to travel."),
    ],
)
def test_provider_cannot_force_ambiguous_meaning_rewrites(message, replacement):
    provider = RecordingProvider(
        {
            "reply": "Could you clarify what you mean?",
            "translation": "Você pode esclarecer o que quis dizer?",
            "facts": [],
            "issues": [
                {
                    "span": message,
                    "replacement": replacement,
                    "severity": "meaning",
                    "skill": "word_choice",
                    "explanation_pt": "sentido",
                    "explanation_en": "meaning",
                }
            ],
        }
    )
    result = LLMAIService(provider).conversation(
        {
            "learner": LEARNER,
            "topic": catalog.topic("free"),
            "context": empty_context(),
            "history": [],
            "userMessage": message,
        }
    )
    assert result["issues"] == []


def _sdk_provider(handler):
    client = anthropic.Anthropic(
        api_key="test-only-key",
        max_retries=0,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    return AnthropicProvider(
        {"ANTHROPIC_API_KEY": "test-only-key", "ANTHROPIC_MODEL": "claude-sonnet-4-5"},
        client=client,
    )


def test_official_sdk_wire_request_and_structured_response():
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "id": "msg_test",
                "type": "message",
                "role": "assistant",
                "content": [
                    {"type": "text", "text": '{"reply":"Hi!","translation":"Oi!"}'}
                ],
                "model": "claude-sonnet-4-5",
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 10, "output_tokens": 10},
            },
        )

    provider = _sdk_provider(handler)
    service = LLMAIService(provider)
    result = service.start_conversation(
        {"learner": LEARNER, "topic": catalog.topic("free")}
    )
    wire = json.loads(requests[0].content)
    assert requests[0].url.path == "/v1/messages"
    assert requests[0].headers["x-api-key"] == "test-only-key"
    assert wire["model"] == "claude-sonnet-4-5"
    assert wire["output_config"]["format"]["type"] == "json_schema"
    assert result["reply"] == "Hi!"
    assert result["ai"]["mode"] == "live"


@pytest.mark.parametrize(
    "status,reason",
    [(401, "authentication"), (429, "rate_limit"), (500, "unavailable")],
)
def test_official_sdk_errors_are_classified_without_leaking_bodies(status, reason):
    provider = _sdk_provider(
        lambda request: httpx.Response(
            status,
            json={
                "type": "error",
                "error": {"type": "api_error", "message": "private-secret-never-show"},
            },
        )
    )
    with pytest.raises(ProviderError) as caught:
        provider.complete(
            {
                "system": "test",
                "messages": [{"role": "user", "content": "Hi"}],
                "jsonSchema": OPENING_SCHEMA,
            }
        )
    assert caught.value.reason == reason
    assert "private-secret" not in str(caught.value)


def test_official_sdk_timeout_is_classified():
    def handler(request):
        raise httpx.ReadTimeout("private timeout body", request=request)

    provider = _sdk_provider(handler)
    with pytest.raises(ProviderError) as caught:
        provider.complete(
            {
                "system": "test",
                "messages": [{"role": "user", "content": "Hi"}],
                "jsonSchema": OPENING_SCHEMA,
            }
        )
    assert caught.value.reason == "timeout"


def test_conversation_journey_privacy_feedback_and_repeated_errors(client, app):
    user_id = register(client)
    conversation = start(client)
    assert conversation["messages"][0]["ai"]["mode"] == "demo"
    first = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"text": "She go to school. My email is alex@example.com."},
    )
    assert first.status_code == 201
    payload = first.get_json()
    assert "alex@example.com" not in payload["userMessage"]["content"]
    assert payload["userMessage"]["notices"]
    assert payload["userMessage"]["corrections"][0]["suggestion"].startswith("She goes")
    second = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"text": "My sister work in a bank."},
    )
    assert second.status_code == 201
    assert second.get_json()["userMessage"]["corrections"] == []
    assert second.get_json()["userMessage"]["deferredCorrections"]
    result = client.post(f"/api/conversations/{conversation['id']}/end").get_json()
    assert result["userMessages"] == 2
    assert result["suggestedLessons"][0]["lessonId"] == "simple-present"
    client.post(f"/api/conversations/{conversation['id']}/end")
    with app.app_context():
        reviews = list(
            db.session.scalars(
                select(Review).where(
                    Review.user_id == user_id, Review.reason == "conversation"
                )
            )
        )
        assert len(reviews) == 1
        messages = list(
            db.session.scalars(
                select(Message)
                .where(Message.conversation_id == conversation["id"])
                .order_by(Message.created_at, Message.id)
            )
        )
        assert [message.role for message in messages] == [
            "assistant",
            "user",
            "assistant",
            "user",
            "assistant",
        ]
    assert (
        client.post(
            f"/api/conversations/{conversation['id']}/messages", json={"text": "Hi"}
        ).status_code
        == 409
    )


def test_privacy_disabled_then_end_deletes_content_but_keeps_metrics(client, app):
    register(client)
    conversation = start(client)
    assert (
        client.patch(
            "/api/me/preferences", json={"saveConversationHistory": False}
        ).status_code
        == 200
    )
    assert client.get("/api/conversations").get_json() == []
    client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"text": "I live in Recife."},
    )
    result = client.post(f"/api/conversations/{conversation['id']}/end").get_json()
    assert result["contentDeleted"] is True
    with app.app_context():
        stored = db.session.get(Conversation, conversation["id"])
        assert stored.user_message_count == 1
        assert stored.context["facts"] == {}
        assert (
            list(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == stored.id)
                )
            )
            == []
        )


def test_expired_and_deleted_content_cannot_be_resurrected(client, app):
    register(client)
    conversation = start(client)
    with app.app_context():
        stored = db.session.get(Conversation, conversation["id"])
        stored.expires_at = "2000-01-01T00:00:00.000Z"
        db.session.commit()
    assert (
        client.get(f"/api/conversations/{conversation['id']}").get_json()["messages"]
        == []
    )
    assert (
        client.post(
            f"/api/conversations/{conversation['id']}/messages", json={"text": "Hi"}
        ).status_code
        == 409
    )
    feedback = client.post(f"/api/conversations/{conversation['id']}/end").get_json()
    assert feedback["feedbackAvailable"] is False
    assert feedback["cleanMessages"] is None
    second = start(client)
    assert client.delete(f"/api/conversations/{second['id']}").status_code == 204
    assert (
        client.post(
            f"/api/conversations/{second['id']}/messages", json={"text": "Hi"}
        ).status_code
        == 409
    )


def test_other_account_and_unauthenticated_access_are_blocked(client, app):
    register(client)
    conversation = start(client)
    other = app.test_client()
    assert other.get(f"/api/conversations/{conversation['id']}").status_code == 401
    register(other, "other@example.com")
    assert other.get(f"/api/conversations/{conversation['id']}").status_code == 404
    assert (
        other.post(
            f"/api/conversations/{conversation['id']}/messages", json={"text": "Hi"}
        ).status_code
        == 404
    )
    assert other.delete(f"/api/conversations/{conversation['id']}").status_code == 404


def test_provider_failure_does_not_persist_half_turn(client, app):
    register(client)
    conversation = start(client)

    class FailedService:
        def conversation(self, data):
            raise ProviderError("timeout")

    app.extensions["english_ai"] = FailedService()
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages", json={"text": "Hi"}
    )
    assert response.status_code == 503
    with app.app_context():
        assert db.session.get(Conversation, conversation["id"]).user_message_count == 0
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
            == 1
        )


def test_database_failure_rolls_back_pair_counter_and_context(client, app, monkeypatch):
    register(client)
    conversation = start(client)
    original_commit = db.session.commit

    def fail_commit():
        db.session.flush()
        raise SQLAlchemyError("simulated commit failure")

    monkeypatch.setattr(db.session, "commit", fail_commit)
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"text": "I live in Recife."},
    )
    assert response.status_code == 503
    monkeypatch.setattr(db.session, "commit", original_commit)
    with app.app_context():
        stored = db.session.get(Conversation, conversation["id"])
        assert stored.user_message_count == 0
        assert stored.context["facts"] == {}
        assert (
            len(
                list(
                    db.session.scalars(
                        select(Message).where(Message.conversation_id == stored.id)
                    )
                )
            )
            == 1
        )


def test_deletion_during_provider_call_cannot_restore_content(client, app):
    user_id = register(client)
    conversation = start(client)
    demo = DemoAIService()

    class DeleteDuringCall:
        def conversation(self, data):
            conversacao.remove(user_id, conversation["id"])
            return demo.conversation(data)

    app.extensions["english_ai"] = DeleteDuringCall()
    response = client.post(
        f"/api/conversations/{conversation['id']}/messages",
        json={"text": "I live in Recife."},
    )
    assert response.status_code == 409
    with app.app_context():
        stored = db.session.get(Conversation, conversation["id"])
        assert stored.content_deleted_at
        assert stored.context["facts"] == {}
        assert stored.user_message_count == 0
        assert (
            list(
                db.session.scalars(
                    select(Message).where(Message.conversation_id == stored.id)
                )
            )
            == []
        )


@pytest.mark.parametrize("value", [None, 123, "", " ", "x" * 601])
def test_invalid_message_inputs_are_rejected(client, value):
    register(client)
    conversation = start(client)
    assert (
        client.post(
            f"/api/conversations/{conversation['id']}/messages", json={"text": value}
        ).status_code
        == 400
    )
