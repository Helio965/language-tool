"""Rendered account notices reflect real provider configuration and persisted origin."""

from html.parser import HTMLParser
from datetime import datetime

import pytest

from ai.provider import create_ai_service


class VisibleText(HTMLParser):
    """Collect document text while excluding JSON/script and stylesheet contents."""

    def __init__(self):
        super().__init__()
        self.parts = []
        self.excluded = 0

    def handle_starttag(self, tag, _attrs):
        if tag in {"script", "style"}:
            self.excluded += 1

    def handle_endtag(self, tag):
        if tag in {"script", "style"}:
            self.excluded -= 1

    def handle_data(self, data):
        if not self.excluded:
            self.parts.append(data)


def visible_text(response):
    parser = VisibleText()
    parser.feed(response.get_data(as_text=True))
    return " ".join(parser.parts)


def ready_account(client):
    created = client.post(
        "/api/auth/register",
        json={
            "name": "Pessoa da Interface",
            "email": "interface@example.test",
            "password": "Interface123",
            "passwordConfirmation": "Interface123",
            "acceptedTerms": True,
        },
    )
    assert created.status_code == 201
    configured = client.put(
        "/api/me/profile",
        json={
            "goal": "basics",
            "perceivedLevel": "beginner",
            "priorExperience": "none",
            "conversationInterest": True,
            "professionalInterest": False,
            "interestAreas": [],
        },
    )
    assert configured.status_code == 200
    assert client.post("/api/placement/skip").status_code == 200


@pytest.mark.parametrize(
    "provider,key,mode",
    [
        ("mock", "", "demo"),
        ("anthropic", "", "unconfigured"),
        ("anthropic", "local-test-placeholder-key", "live"),
    ],
)
def test_account_provider_notices_use_configuration_status(
    app, client, provider, key, mode
):
    ready_account(client)
    app.extensions["english_ai"] = create_ai_service(
        {
            "AI_PROVIDER": provider,
            "ANTHROPIC_API_KEY": key,
            "ANTHROPIC_MODEL": "claude-sonnet-4-5",
        }
    )
    assert client.get("/api/me").json["ai"]["mode"] == mode
    for path in ["/inicio", "/perfil", "/conversar"]:
        response = client.get(path)
        assert response.status_code == 200
        text = visible_text(response)
        if mode == "unconfigured":
            assert "IA externa ainda não configurada" in text
            assert "IA em demonstração" not in text
        elif mode == "demo":
            assert "respostas simuladas" in text
            assert "IA externa ainda não configurada" not in text
        else:
            assert "IA externa ainda não configurada" not in text
            assert "respostas simuladas" not in text
        if key:
            assert key not in response.get_data(as_text=True)


def test_historical_message_origin_survives_provider_change(app, client):
    ready_account(client)
    started = client.post("/api/conversations", json={"topicId": "free"})
    assert started.status_code == 201
    conversation_id = started.json["id"]
    original = started.json["messages"][0]
    assert original["ai"]["mode"] == "demo"
    app.extensions["english_ai"] = create_ai_service(
        {
            "AI_PROVIDER": "anthropic",
            "ANTHROPIC_API_KEY": "",
            "ANTHROPIC_MODEL": "claude-sonnet-4-5",
        }
    )
    resumed = client.get(f"/api/conversations/{conversation_id}")
    assert resumed.status_code == 200
    assert resumed.json["ai"]["mode"] == "unconfigured"
    assert resumed.json["messages"][0]["ai"]["mode"] == "demo"
    assert resumed.json["messages"][0]["content"] == original["content"]


@pytest.mark.parametrize("days", [7, 30])
def test_displayed_retention_matches_actual_conversation_expiration(app, client, days):
    app.config["CONVERSATION_RETENTION_DAYS"] = days
    ready_account(client)
    created = client.post("/api/conversations", json={"topicId": "free"})
    assert created.status_code == 201
    from extensions import db
    from models import Conversation

    with app.app_context():
        conversation = db.session.get(Conversation, created.json["id"])
        created_at = datetime.fromisoformat(
            conversation.created_at.replace("Z", "+00:00")
        )
        expires_at = datetime.fromisoformat(
            conversation.expires_at.replace("Z", "+00:00")
        )
        assert (expires_at - created_at).days == days
    for path in ["/preferencias", "/privacidade", "/termos-e-privacidade"]:
        response = client.get(path)
        assert response.status_code == 200
        text = visible_text(response)
        assert f"{days} dias" in text
        assert "90 dias" not in text
