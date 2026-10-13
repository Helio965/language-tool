"""Preserve browser behavior while retiring the React/Vite implementation."""

import json
import re

import pytest
from playwright.sync_api import expect

from content import catalog
from extensions import db
from models import ExerciseAttempt, UserVocabulary
from test_journeys import (
    beginner,
    browser_page as browser_page,
    enter_lesson_exercises,
    learner_id,
    web as web,
)
from test_ui_recovery import recovery_page as recovery_page

pytestmark = pytest.mark.browser


def test_mobile_landing_menu_keyboard_anchors_fonts_and_editable_selection(
    browser_page,
):
    page = browser_page
    page.set_viewport_size({"width": 390, "height": 844})
    page.emulate_media(reduced_motion="reduce")
    page.goto("/")
    title = page.get_by_role("heading", level=1)
    expect(title).to_be_visible()
    page.evaluate("async () => { await document.fonts.ready; }")
    for font in ["Fraunces Variable", "Atkinson Hyperlegible Next Variable"]:
        assert page.evaluate("font => document.fonts.check(`16px '${font}'`)", font)
        assert page.evaluate(
            "font => [...document.fonts].some(face => "
            "face.family.includes(font) && face.status === 'loaded')",
            font,
        )
    assert title.evaluate("node => getComputedStyle(node).userSelect") == "none"

    menu = page.get_by_role("button", name="Menu de seções", exact=True)
    navigation = page.get_by_role("navigation", name="Seções da página", exact=True)
    expect(menu).to_have_attribute("aria-expanded", "false")
    menu.click()
    expect(menu).to_have_attribute("aria-expanded", "true")
    page.keyboard.press("Escape")
    expect(menu).to_have_attribute("aria-expanded", "false")
    expect(menu).to_be_focused()

    history_length = page.evaluate("history.length")
    menu.click()
    navigation.get_by_role("link", name="Conversar", exact=True).click()
    expect(page).to_have_url(re.compile(r"/#conversar$"))
    expect(menu).to_have_attribute("aria-expanded", "false")
    expect(page.locator("#conversar-title")).to_be_focused()
    expect(page.locator("#conversar-title")).to_be_in_viewport()
    assert page.evaluate("history.length") == history_length
    page.goto("/entrar")
    page.goto("/#seguranca")
    expect(page.locator("#seguranca-title")).to_be_focused()

    page.get_by_role("link", name="Criar conta", exact=True).first.click()
    expect(page.locator("#auth-form")).to_be_visible()
    name = page.get_by_label("Nome", exact=True)
    name.fill("Pessoa de teste")
    assert name.evaluate("node => getComputedStyle(node).userSelect") == "text"
    name.select_text()
    assert (
        name.evaluate(
            "node => node.value.slice(node.selectionStart, node.selectionEnd)"
        )
        == "Pessoa de teste"
    )
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_logout_notifies_other_tab_and_back_cannot_reveal_private_pages(browser_page):
    page = browser_page
    email = beginner(page)
    page.goto("/progresso")
    expect(
        page.get_by_role("heading", name="Seu progresso", exact=True)
    ).to_be_visible()
    expect(
        page.get_by_role("heading", name="Nada por aqui ainda", exact=True)
    ).to_be_visible()
    other = page.context.new_page()
    errors = []
    other.on("pageerror", lambda error: errors.append(str(error)))
    private_requests = []
    page.on(
        "request",
        lambda request: (
            private_requests.append(request.url)
            if "/api/" in request.url and "/api/auth/" not in request.url
            else None
        ),
    )
    try:
        other.goto("/inicio")
        expect(other.get_by_role("heading", level=1)).to_be_visible()
        other.goto("/perfil")
        expect(other.get_by_text(email, exact=True)).to_be_visible()
        other.get_by_role("button", name="Sair da conta", exact=True).click()
        other.wait_for_url("**/entrar?signed_out=1")
        page.wait_for_url("**/entrar?signed_out=1")
        for tab in [page, other]:
            expect(
                tab.get_by_text("Você saiu da sua conta.", exact=True)
            ).to_be_visible()
            expect(tab.get_by_text("Sua sessão expirou.", exact=False)).to_have_count(0)
            tab.go_back()
            expect(tab.locator("#auth-form")).to_be_visible()
            expect(tab.get_by_text(email, exact=True)).to_have_count(0)
            expect(tab.get_by_role("heading", name="Perfil", exact=True)).to_have_count(
                0
            )
        assert not private_requests
    finally:
        other.close()
    assert not errors


def test_switching_accounts_preserves_a_vocabulary_without_showing_it_to_b(
    browser_page, web
):
    page = browser_page
    email_a = beginner(page)
    page.goto("/vocabulario")
    suggestion = page.locator(".vocabulary-suggestions [data-word]").first
    word_id = suggestion.get_attribute("data-word")
    suggestion.click()
    page.get_by_role("button", name="Adicionar ao meu vocabulário", exact=True).click()
    expect(page.locator(f'#word-list [data-word="{word_id}"]')).to_contain_text(
        "Estudando"
    )
    page.goto("/perfil")
    page.get_by_role("button", name="Sair da conta", exact=True).click()
    page.wait_for_url("**/entrar?signed_out=1")

    email_b = beginner(page)
    page.goto("/vocabulario")
    expect(
        page.get_by_role(
            "heading", name="Seu vocabulário começa na primeira aula", exact=True
        )
    ).to_be_visible()
    expect(page.locator("#word-list [data-word]")).to_have_count(0)
    page.goto("/perfil")
    expect(page.get_by_text(email_b, exact=True)).to_be_visible()
    expect(page.get_by_text(email_a, exact=True)).to_have_count(0)
    page.get_by_role("button", name="Sair da conta", exact=True).click()
    page.wait_for_url("**/entrar?signed_out=1")

    page.get_by_label("E-mail", exact=True).fill(email_a)
    page.get_by_label("Senha", exact=True).fill("PythonTest123")
    page.get_by_label("Senha", exact=True).press("Enter")
    page.wait_for_url("**/inicio")
    page.goto("/vocabulario")
    expect(page.locator(f'#word-list [data-word="{word_id}"]')).to_contain_text(
        "Estudando"
    )
    user_a = learner_id(web, email_a)
    user_b = learner_id(web, email_b)
    with web["app"].app_context():
        assert db.session.get(UserVocabulary, (user_a, word_id)).status == "learning"
        assert db.session.get(UserVocabulary, (user_b, word_id)) is None


def test_exercise_retry_clears_failed_request_and_saves_one_answer(recovery_page, web):
    page = recovery_page
    email = beginner(page)
    exercise = catalog.lesson("greetings")["exercises"][0]
    enter_lesson_exercises(page)
    requests = []

    def fail_once(route):
        requests.append(
            {
                "key": route.request.headers["idempotency-key"],
                "body": route.request.post_data_json,
            }
        )
        if len(requests) == 1:
            route.fulfill(
                status=503,
                content_type="application/json",
                body=json.dumps(
                    {
                        "error": {
                            "code": "PERSISTENCE_FAILED",
                            "message": "Falha temporária de teste.",
                        }
                    }
                ),
            )
        else:
            route.continue_()

    page.route("**/api/lessons/greetings/exercises/*/answer", fail_once)
    answer = exercise["acceptedAnswers"][0]
    page.locator("#exercise-form").get_by_text(answer, exact=True).click()
    verify = page.get_by_role("button", name="Verificar", exact=True)
    verify.click()
    expect(page.locator("#exercise-error")).to_contain_text(
        "Falha temporária de teste."
    )
    expect(verify).to_be_enabled()
    expect(page.locator(".exercise-feedback")).to_have_count(0)
    user_id = learner_id(web, email)
    with web["app"].app_context():
        assert (
            db.session.scalar(
                db.select(ExerciseAttempt.id).where(ExerciseAttempt.user_id == user_id)
            )
            is None
        )

    verify.click()
    expect(page.locator(".exercise-feedback")).to_have_class(
        re.compile(r"exercise-feedback_correct\b")
    )
    expect(page.locator(".exercise-feedback")).to_contain_text("Por que está certo")
    expect(page.locator("#exercise-error")).to_be_hidden()
    expect(page.locator("#exercise-next")).to_be_focused()
    assert len(requests) == 2
    assert requests[0] == requests[1]
    with web["app"].app_context():
        attempts = db.session.scalars(
            db.select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
        ).all()
        assert len(attempts) == 1
        assert attempts[0].exercise_id == exercise["id"]
