"""Public previews and unavailable controls preserve honest product behavior."""

import re
from extensions import db
from models import Preferences
from tests.test_auth import register
from tests.test_ui_contracts import ready_account, visible_text


def test_landing_preserves_previews_without_fictitious_result_claims(client):
    response = client.get("/")
    html = response.get_data(as_text=True)
    assert "Exemplo ilustrativo" not in html
    assert "landing-exampleTag" not in html
    assert html.count('aria-describedby="platform-preview-note"') == 5
    assert html.count('id="platform-preview-note"') == 1
    assert "sem representar resultados de alunos" in visible_text(response)
    assert "82%" in html  # Demonstration remains present, with shared context.
    assert "aulas no catálogo" in html
    assert "Começar gratuitamente" not in html


def test_public_and_account_pages_have_product_copy_and_legal_transparency(client):
    for path in [
        "/",
        "/entrar",
        "/cadastro",
        "/recuperar-senha",
        "/termos-e-privacidade",
    ]:
        text = visible_text(client.get(path)).lower()
        assert "acadêmico" not in text and "mvp" not in text
    legal = visible_text(client.get("/termos-e-privacidade"))
    assert "provisório" in legal and "revisão jurídica" in legal
    assert "não garantem a remoção de todos os dados pessoais" in legal
    ready_account(client)
    for path in ["/inicio", "/perfil", "/preferencias", "/privacidade"]:
        response = client.get(path)
        assert response.status_code == 200
        assert "acadêmico" not in visible_text(response).lower()
    preferences = client.get("/preferencias").get_data(as_text=True)
    assert re.search(r'name="studyReminders"[^>]*disabled', preferences)


def test_reminder_changes_rejected_without_overwriting_legacy_value(app, client):
    account = register(client).json
    user_id = account["user"]["id"]
    with app.app_context():
        row = db.session.get(Preferences, user_id)
        row.study_reminders = True
        db.session.commit()
    rejected = client.patch(
        "/api/me/preferences", json={"studyReminders": False, "dailyGoalMinutes": 20}
    )
    assert rejected.status_code == 409
    assert rejected.json["error"]["code"] == "FEATURE_UNAVAILABLE"
    unchanged = client.get("/api/me/preferences").json
    assert unchanged["studyReminders"] is True
    assert unchanged["dailyGoalMinutes"] == 10
    saved = client.patch("/api/me/preferences", json={"dailyGoalMinutes": 20})
    assert saved.status_code == 200 and saved.json["studyReminders"] is True
    assert saved.json["dailyGoalMinutes"] == 20


def test_learning_outputs_include_demo_provenance(client):
    ready_account(client)
    for endpoint in ["explain", "example"]:
        response = client.post(
            f"/api/lessons/greetings/{endpoint}", json={"attempt": 0}
        )
        assert response.status_code == 200
        assert response.json["ai"]["mode"] == "demo"
        assert response.json["ai"]["provider"] == "mock"
