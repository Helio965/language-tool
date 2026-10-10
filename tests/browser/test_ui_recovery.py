"""Browser regressions for recovery from failed requests and honest AI provenance."""

import json
import os
import re
import shutil

import pytest
from playwright.sync_api import expect, sync_playwright

from ai.provider import create_ai_service
from test_journeys import beginner, web

pytestmark = pytest.mark.browser


@pytest.fixture
def recovery_page(web):
    with sync_playwright() as playwright:
        executable = os.environ.get("CHROMIUM_EXECUTABLE") or shutil.which("chromium")
        browser = playwright.chromium.launch(
            **({"executable_path": executable} if executable else {})
        )
        context = browser.new_context(
            base_url=web["url"], viewport={"width": 390, "height": 844}
        )
        page = context.new_page()
        errors = []
        # Deliberate request failures are expected; uncaught JavaScript errors are not.
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on(
            "console",
            lambda message: (
                errors.append(message.text)
                if message.type == "error"
                and not any(
                    expected in message.text
                    for expected in ["status of 503", "net::ERR_CONNECTION_FAILED"]
                )
                else None
            ),
        )
        yield page
        assert not errors, "Uncaught browser errors: " + "; ".join(errors)
        context.close()
        browser.close()


def test_reset_verify_retries_connection_failure_without_exposing_form(
    recovery_page, web
):
    page = recovery_page
    email = beginner(page)
    # In-memory test delivery is deterministic and never contacts SMTP.
    service = web["app"].extensions["email_service"]
    service.idle()
    service.transport = "memory"
    with web["app"].test_client() as client:
        csrf = client.get("/api/csrf").json["csrfToken"]
        response = client.post(
            "/api/auth/password-reset",
            json={"email": email},
            headers={"X-CSRFToken": csrf},
        )
        assert response.status_code == 202
    token = re.search(
        r"/redefinir-senha/([A-Za-z0-9_-]{43})", service.messages[-1]["text"]
    ).group(1)
    attempts = []

    def verify_request(route):
        attempts.append(route.request.post_data_json)
        if len(attempts) == 1:
            route.abort("connectionfailed")
        else:
            route.continue_()

    page.route("**/api/auth/password-reset/verify", verify_request)
    page.goto(f"/redefinir-senha/{token}")
    retry = page.get_by_role("button", name="Tentar novamente", exact=True)
    expect(retry).to_be_visible()
    expect(retry).to_be_focused()
    expect(page.locator("#auth-form")).to_be_hidden()
    expect(page.get_by_text("Sem conexão com o servidor.", exact=False)).to_be_visible()
    retry.press("Enter")
    expect(page.locator("#auth-form")).to_be_visible()
    expect(retry).not_to_be_visible()
    expect(
        page.get_by_role("heading", name="Criar uma senha nova", exact=True)
    ).to_be_focused()
    assert len(attempts) == 2
    page.get_by_label("Nova senha", exact=True).fill("Recovered123")
    page.get_by_label("Confirme a nova senha", exact=True).fill("Recovered123")
    page.locator("#auth-submit").click()
    expect(
        page.get_by_role("heading", name="Senha redefinida com sucesso.", exact=True)
    ).to_be_visible()


@pytest.mark.parametrize(
    "failed_request,expected_value", [(1, "light"), (2, "detailed")]
)
def test_rapid_preference_changes_keep_latest_confirmed_state(
    recovery_page, failed_request, expected_value
):
    page = recovery_page
    beginner(page)
    page.goto("/preferencias")
    calls = []

    def preference_request(route):
        calls.append(route.request.post_data_json)
        if len(calls) == failed_request:
            route.fulfill(
                status=503,
                content_type="application/json",
                body=json.dumps(
                    {
                        "error": {
                            "code": "PERSISTENCE_FAILED",
                            "message": "Falha temporária de teste.",
                        },
                    }
                ),
            )
        else:
            route.continue_()

    page.route("**/api/me/preferences", preference_request)
    # Queue both changes before the failed request settles.
    page.evaluate("""async () => {
        await import('/static/js/account.js');
        for (const value of ['detailed', 'light']) {
            const radio = document.querySelector(`input[name=correctionIntensity][value=${value}]`);
            radio.checked = true;
            radio.dispatchEvent(new Event('change', {bubbles: true}));
        }
    }""")
    if failed_request == 1:
        expect(page.get_by_text("Preferência salva.", exact=True)).to_be_visible()
        expect(page.locator("#preferences-error")).to_be_hidden()
    else:
        expect(
            page.get_by_text("Falha temporária de teste.", exact=True)
        ).to_be_visible()
    assert calls == [
        {"correctionIntensity": "detailed"},
        {"correctionIntensity": "light"},
    ]
    expect(
        page.locator(f'input[name="correctionIntensity"][value="{expected_value}"]')
    ).to_be_checked()
    expect(
        page.locator(f'.choice-segment:has(input[value="{expected_value}"])')
    ).to_have_class(re.compile(r"choice-selected"))
    stored = page.evaluate(
        "async () => (await (await fetch('/api/me')).json()).preferences.correctionIntensity"
    )
    assert stored == expected_value
    page.reload()
    expect(
        page.locator(f'input[name="correctionIntensity"][value="{expected_value}"]')
    ).to_be_checked()


def test_historical_demo_and_deleted_summary_are_honest(recovery_page, web):
    page = recovery_page
    beginner(page)
    page.goto("/conversar")
    page.locator("#topic-free").click()
    page.wait_for_url("**/conversar/*")
    page.locator("#chat-input").fill("My name is Test and I am a student.")
    page.locator("#chat-send").click()
    expect(page.locator("#chat-pending")).to_have_count(0)
    expect(page.locator("#chat-message-count")).to_have_text("1")
    conversation_path = page.url.replace(web["url"], "")
    web["app"].extensions["english_ai"] = create_ai_service(
        {
            "AI_PROVIDER": "anthropic",
            "ANTHROPIC_API_KEY": "",
            "ANTHROPIC_MODEL": "claude-sonnet-4-5",
        }
    )
    page.reload()
    expect(
        page.get_by_text("A IA externa ainda não está configurada.", exact=False)
    ).to_be_visible()
    expect(
        page.get_by_text(
            "Resposta simulada · roteiro da demonstração", exact=True
        ).first
    ).to_be_visible()
    page.goto("/privacidade")
    page.locator("#clear-history").click()
    page.get_by_role("button", name="Apagar histórico", exact=True).click()
    expect(page.locator("#ui-dialog")).not_to_be_visible()
    page.goto(conversation_path)
    page.get_by_role("button", name="Ver resumo", exact=True).click()
    expect(
        page.get_by_role("heading", name="Conversa encerrada", exact=True)
    ).to_be_visible()
    expect(
        page.get_by_role("heading", name="Feedback indisponível", exact=True)
    ).to_be_visible()
    summary_text = page.locator("#feature-content").inner_text()
    assert "—" in summary_text
    assert "impecável" not in summary_text and "Nenhuma correção" not in summary_text
    expect(page.get_by_role("link", name="Nova conversa", exact=True)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
