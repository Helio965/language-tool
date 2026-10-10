"""Real browser journeys over Flask, signed CSRF, SQLAlchemy and SQLite."""

import os
import json
import re
import shutil
import threading
from pathlib import Path
from uuid import uuid4

import pytest
from playwright.sync_api import expect, sync_playwright
from werkzeug.serving import make_server

from app import create_app
from content import catalog
from extensions import db
from models import (
    Conversation,
    ExerciseAttempt,
    Message,
    Progress,
    Review,
    User,
    UserVocabulary,
)

pytestmark = pytest.mark.browser


@pytest.fixture
def web(tmp_path):
    application = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "browser-tests-session-secret-32-characters",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'browser.db'}",
            "AUTO_INIT_DB": True,
            "WTF_CSRF_ENABLED": True,
            "RATELIMIT_ENABLED": False,
            "AI_PROVIDER": "mock",
            "MAIL_TRANSPORT": "outbox",
            "MAIL_OUTBOX_DIR": str(tmp_path / "outbox"),
            "APP_PUBLIC_URL": "http://localhost:5000",
        }
    )
    server = make_server("127.0.0.1", 0, application, threaded=True)
    url = f"http://127.0.0.1:{server.server_port}"
    application.config["APP_PUBLIC_URL"] = url
    # The email service captures its trusted URL at initialization.
    application.extensions["email_service"].app_url = url
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield {
        "app": application,
        "url": url,
        "outbox": tmp_path / "outbox",
        "tmp": tmp_path,
    }
    server.shutdown()
    thread.join(timeout=5)
    with application.app_context():
        db.session.remove()
        db.engine.dispose()


@pytest.fixture
def browser_page(web):
    executable = os.environ.get("CHROMIUM_EXECUTABLE") or shutil.which("chromium")
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            **({"executable_path": executable} if executable else {})
        )
        context = browser.new_context(
            base_url=web["url"], viewport={"width": 1280, "height": 900}
        )
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on(
            "console",
            lambda message: (
                errors.append(message.text)
                if message.type == "error"
                and not any(
                    f"status of {status}" in message.text for status in [400, 401]
                )
                else None
            ),
        )
        yield page
        context.close()
        browser.close()
        assert not errors, "Browser errors: " + "; ".join(errors)


def signup(page, name="Aluno Python", email=None):
    email = email or f"aluno-{uuid4().hex[:10]}@example.test"
    page.goto("/cadastro")
    page.get_by_label("Nome", exact=True).fill(name)
    page.get_by_label("E-mail", exact=True).fill(email)
    page.get_by_label("Senha", exact=True).fill("PythonTest123")
    page.get_by_label("Confirme a senha", exact=True).fill("PythonTest123")
    page.locator("#acceptedTerms").check()
    page.locator("#auth-submit").click()
    page.wait_for_url("**/configuracao")
    return email


def configure(page):
    page.locator('input[name="goal"][value="basics"]').check(force=True)
    page.locator("#onboarding-next").click()
    page.locator('input[name="perceivedLevel"][value="beginner"]').check(force=True)
    page.locator('input[name="priorExperience"][value="school"]').check()
    page.locator("#onboarding-next").click()
    page.locator('input[name="interestAreas"][value="education"]').check()
    page.locator("#onboarding-next").click()
    page.wait_for_url("**/nivelamento")


def beginner(page):
    email = signup(page)
    configure(page)
    page.locator("#placement-skip").click()
    page.get_by_role("link", name="Ir para o início", exact=True).click()
    page.wait_for_url("**/inicio")
    expect(page.get_by_role("heading", level=1)).to_be_visible()
    return email


def enter_lesson_exercises(page, lesson_id="greetings"):
    page.goto(f"/aprender/aula/{lesson_id}")
    page.locator("#lesson-start").click()
    for _stage in range(3):
        page.locator("#lesson-next").click()
    expect(page.locator("#exercise-form")).to_be_visible()


def answer_activity(page, exercise, correct=True):
    expect(page.locator(".exercise-prompt")).to_have_text(exercise["prompt"])
    if exercise["type"] in {"multiple_choice", "select_word"}:
        value = (
            exercise["acceptedAnswers"][0]
            if correct
            else next(
                option
                for option in exercise["options"]
                if option not in exercise["acceptedAnswers"]
            )
        )
        page.locator("#exercise-form").get_by_text(value, exact=True).click()
    else:
        value = (
            exercise["acceptedAnswers"][0]
            if correct
            else "an unrelated incorrect answer"
        )
        page.locator("#exercise-answer").fill(value)
    page.locator("#exercise-verify").click()
    expect(page.locator(".exercise-feedback")).to_have_class(
        re.compile(
            r"exercise-feedback_correct\b"
            if correct
            else r"exercise-feedback_incorrect\b"
        )
    )
    page.locator("#exercise-next").click()


def learner_id(web, email):
    with web["app"].app_context():
        return db.session.scalar(db.select(User.id).where(User.email == email))


def test_complete_lesson_resumes_saved_answer_and_keeps_score_after_reload(
    browser_page, web
):
    page = browser_page
    email = beginner(page)
    lesson = catalog.lesson("greetings")
    enter_lesson_exercises(page)
    answer_activity(page, lesson["exercises"][0])
    # Reload after one answer exercises the persisted passage, not JS memory.
    enter_lesson_exercises(page)
    for exercise in lesson["exercises"][1:]:
        answer_activity(page, exercise)
    expect(page.get_by_role("heading", name="Mandou bem!", exact=True)).to_be_visible()
    expect(page.locator('[data-stage-index="5"]')).to_have_attribute(
        "aria-current", "step"
    )
    expect(page.get_by_text("5 de 5 · 100% de acertos", exact=False)).to_be_visible()
    page.screenshot(path="/tmp/language-tool-python-lesson-desktop.png", full_page=True)
    page.goto("/aprender")
    row = page.locator('.learn-lessonCard[href="/aprender/aula/greetings"]')
    expect(row).to_contain_text("Concluída · 100%")
    page.reload()
    expect(row).to_contain_text("Concluída · 100%")
    page.goto("/progresso")
    expect(
        page.locator(".display-stat")
        .filter(has_text="Aulas concluídas")
        .locator(".display-statValue")
    ).to_have_text("1")
    expect(
        page.locator(".display-stat")
        .filter(has_text="Taxa de acertos")
        .locator(".display-statValue")
    ).to_have_text("100%")
    user_id = learner_id(web, email)
    with web["app"].app_context():
        progress = db.session.get(Progress, (user_id, "greetings"))
        assert (progress.correct_count, progress.total_count, progress.score) == (
            5,
            5,
            100,
        )
        assert (
            len(
                db.session.scalars(
                    db.select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
                ).all()
            )
            == 5
        )
        assert len(
            db.session.scalars(
                db.select(UserVocabulary).where(UserVocabulary.user_id == user_id)
            ).all()
        ) == len(lesson["vocabularyIds"])


def test_low_score_lesson_creates_server_review_and_saves_completed_review(
    browser_page, web
):
    page = browser_page
    email = beginner(page)
    lesson = catalog.lesson("greetings")
    enter_lesson_exercises(page)
    for index, exercise in enumerate(lesson["exercises"]):
        answer_activity(page, exercise, correct=index == 0)
    expect(page.get_by_text("1 de 5 · 20% de acertos", exact=False)).to_be_visible()
    page.get_by_role("link", name="Revisar agora", exact=True).click()
    review_card = page.locator(".review-card").filter(
        has=page.get_by_role("heading", name=lesson["title"], exact=True)
    )
    expect(review_card).to_contain_text("20%")
    review_link = review_card.get_by_role("link", name="Revisar", exact=True)
    review_id = review_link.get_attribute("href").rsplit("/", 1)[1]
    with page.expect_response(
        lambda response: (
            response.url.endswith(f"/api/reviews/{review_id}/session")
            and response.request.method == "POST"
        )
    ) as response:
        review_link.click()
    issued_session = response.value.json()
    assert response.value.status == 200
    assert issued_session["exercises"], "Server issued no review exercises"
    for exercise in issued_session["exercises"]:
        answer_activity(page, catalog.exercise(exercise["id"])["exercise"])
    expect(
        page.get_by_role("heading", name="100% de acertos", exact=True)
    ).to_be_visible()
    page.get_by_role("link", name="Voltar à revisão", exact=True).click()
    page.reload()
    expect(
        page.get_by_text("1 revisões concluídas até agora.", exact=True)
    ).to_be_visible()
    with web["app"].app_context():
        review = db.session.get(Review, review_id)
        assert review.user_id == learner_id(web, email)
        assert (review.status, review.last_score, review.times_reviewed) == (
            "done",
            100,
            1,
        )
        assert review.completion_result["total"] == len(issued_session["exercises"])


def test_vocabulary_save_learn_filter_and_reload(browser_page, web):
    page = browser_page
    email = beginner(page)
    page.goto("/vocabulario")
    suggested = page.locator(".vocabulary-suggestions [data-word]").first
    word_id = suggested.get_attribute("data-word")
    word = catalog.vocabulary_entry(word_id)
    suggested.click()
    page.get_by_role("button", name="Adicionar ao meu vocabulário", exact=True).click()
    studied = page.locator(f'#word-list [data-word="{word_id}"]')
    expect(studied).to_contain_text("Estudando")
    studied.click()
    page.get_by_role("button", name="Já aprendi", exact=True).click()
    expect(studied).to_contain_text("Aprendida")
    page.reload()
    expect(studied).to_contain_text("Aprendida")
    page.get_by_role("button", name="Aprendidas", exact=True).click()
    page.get_by_label("Buscar palavra", exact=True).fill(word["word"])
    expect(page.locator("#word-list [data-word]")).to_have_count(1)
    expect(studied).to_contain_text(word["word"])
    with web["app"].app_context():
        assert (
            db.session.get(UserVocabulary, (learner_id(web, email), word_id)).status
            == "learned"
        )


def test_demo_conversation_feedback_privacy_clear_and_password_confirmed_deletion(
    browser_page, web
):
    page = browser_page
    email = beginner(page)
    user_id = learner_id(web, email)
    page.goto("/preferencias")
    with page.expect_response(
        lambda response: (
            response.url.endswith("/api/me/preferences")
            and response.request.method == "PATCH"
        )
    ):
        page.locator('input[name="correctionIntensity"][value="detailed"]').check(
            force=True
        )
    page.goto("/conversar")
    expect(
        page.get_by_text("Não são geradas por uma IA real.", exact=False)
    ).to_be_visible()
    page.locator("#topic-introductions").click()
    page.wait_for_url("**/conversar/*")
    conversation_id = page.url.rsplit("/", 1)[1]
    for index, text in enumerate(["She go to school every day.", "She go to school."]):
        page.get_by_label("Sua mensagem em inglês", exact=True).fill(text)
        page.get_by_role("button", name="Enviar mensagem", exact=True).click()
        expect(page.locator("#chat-message-count")).to_have_text(str(index + 1))
    expect(page.locator("#chat-correction-count")).to_have_text("2")
    expect(page.locator("#chat-log")).to_contain_text("goes")
    page.reload()
    expect(page.locator("#chat-message-count")).to_have_text("2")
    page.set_viewport_size({"width": 390, "height": 844})
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), (
        "Chat overflows on mobile"
    )
    page.screenshot(path="/tmp/language-tool-python-chat-mobile.png", full_page=True)
    page.locator("#conversation-end").click()
    page.get_by_role("button", name="Encerrar e ver feedback", exact=True).click()
    expect(
        page.get_by_role(
            "heading", name="Boa conversa! Veja o que praticar", exact=True
        )
    ).to_be_visible()
    with web["app"].app_context():
        conversation = db.session.get(Conversation, conversation_id)
        assert conversation.ended_at is not None
        assert (
            db.session.scalar(
                db.select(Review).where(
                    Review.user_id == user_id,
                    Review.ref_id == "simple_present",
                    Review.status == "pending",
                )
            )
            is not None
        )
    page.goto("/privacidade")
    page.locator("#clear-history").click()
    page.get_by_role("button", name="Apagar histórico", exact=True).click()
    expect(page.locator("#toast")).to_contain_text("1 conversas apagadas.")
    page.goto("/conversar")
    expect(page.get_by_text("Nenhuma conversa ainda", exact=True)).to_be_visible()
    page.goto(f"/conversar/{conversation_id}")
    page.get_by_role("button", name="Ver resumo", exact=True).click()
    expect(
        page.get_by_role("heading", name="Feedback indisponível", exact=True)
    ).to_be_visible()
    with web["app"].app_context():
        assert (
            db.session.get(Conversation, conversation_id).content_deleted_at is not None
        )
        assert (
            db.session.scalar(
                db.select(Message).where(Message.conversation_id == conversation_id)
            )
            is None
        )
    page.goto("/privacidade")
    page.locator("#delete-account").click()
    page.get_by_label("Senha", exact=True).fill("wrong-password")
    page.locator("#delete-submit").click()
    expect(page.locator("#delete-error")).to_contain_text("Senha incorreta")
    page.get_by_label("Senha", exact=True).fill("PythonTest123")
    page.locator("#delete-submit").click()
    page.wait_for_url("**/?deleted=1")
    page.goto("/perfil")
    page.wait_for_url("**/entrar?next=**")
    with web["app"].app_context():
        assert db.session.get(User, user_id) is None
        assert db.session.get(Conversation, conversation_id) is None
        assert (
            db.session.scalar(db.select(Review).where(Review.user_id == user_id))
            is None
        )


def test_password_reset_outbox_link_single_use_and_old_session_revoked(
    browser_page, web
):
    page = browser_page
    email = beginner(page)
    old_cookies = page.context.cookies()
    browser = page.context.browser
    reset_context = browser.new_context(base_url=web["url"])
    stale_context = browser.new_context(base_url=web["url"])
    extra_page_errors = []
    try:
        stale_context.add_cookies(old_cookies)
        stale_page = stale_context.new_page()
        stale_page.on("pageerror", lambda error: extra_page_errors.append(str(error)))
        stale_page.goto("/perfil")
        expect(
            stale_page.get_by_role("heading", name="Perfil", exact=True)
        ).to_be_visible()
        reset_page = reset_context.new_page()
        reset_page.on("pageerror", lambda error: extra_page_errors.append(str(error)))
        reset_page.goto("/recuperar-senha")
        reset_page.get_by_label("E-mail", exact=True).fill(email)
        reset_page.locator("#auth-submit").click()
        expect(
            reset_page.get_by_text("Se existir uma conta com este e-mail", exact=False)
        ).to_be_visible()
        web["app"].extensions["email_service"].idle()
        records = [
            json.loads(path.read_text()) for path in web["outbox"].glob("*.json")
        ]
        reset_email = next(
            record
            for record in records
            if record["kind"] == "password_reset" and record["to"] == email
        )
        reset_url = re.search(
            r"https?://[^\s]+/redefinir-senha/[A-Za-z0-9_-]+", reset_email["text"]
        ).group(0)
        reset_page.goto(reset_url)
        reset_page.get_by_label("Nova senha", exact=True).fill("NewPythonPass456")
        reset_page.get_by_label("Confirme a nova senha", exact=True).fill(
            "NewPythonPass456"
        )
        reset_page.locator("#auth-submit").click()
        expect(
            reset_page.get_by_role(
                "heading", name="Senha redefinida com sucesso.", exact=True
            )
        ).to_be_visible()
        stale_page.reload()
        stale_page.wait_for_url("**/entrar?next=**")
        page.reload()
        page.wait_for_url("**/entrar?next=**")
        page.get_by_label("E-mail", exact=True).fill(email)
        page.get_by_label("Senha", exact=True).fill("PythonTest123")
        page.locator("#auth-submit").click()
        expect(page.locator("#form-message")).to_contain_text(
            "E-mail ou senha incorretos"
        )
        page.get_by_label("Senha", exact=True).fill("NewPythonPass456")
        page.locator("#auth-submit").click()
        page.wait_for_url("**/inicio")
        expect(page.get_by_role("heading", level=1)).to_be_visible()
        reset_page.goto(reset_url)
        expect(
            reset_page.get_by_role("heading", name="Este link já foi usado", exact=True)
        ).to_be_visible()
    finally:
        reset_context.close()
        stale_context.close()
    assert not extra_page_errors, (
        "Browser errors in reset/session contexts: " + "; ".join(extra_page_errors)
    )


def test_new_user_actual_placement_then_first_lesson(browser_page):
    page = browser_page
    signup(page)
    configure(page)
    page.locator("#placement-start").click()
    questions = catalog.placement_questions()[:4]
    for index, question in enumerate(questions):
        expect(page.locator("#placement-form")).to_be_visible()
        # Two correct answers keep the pedagogical estimate at beginner.
        answer = (
            question["answer"]
            if index < 2
            else next(
                option for option in question["options"] if option != question["answer"]
            )
        )
        page.get_by_text(answer, exact=True).click()
        page.locator("#placement-next").click()
    expect(page.get_by_role("heading", name="Iniciante", exact=True)).to_be_visible()
    expect(
        page.get_by_text("não é uma certificação oficial", exact=False)
    ).to_be_visible()
    page.get_by_role("link", name="Ir para o início", exact=True).click()
    page.goto("/aprender/aula/greetings")
    expect(page.locator("#lesson-start")).to_be_visible()
    page.reload()
    expect(page.locator("#lesson-start")).to_be_visible()


def test_private_navigation_blocks_anonymous_user(browser_page):
    page = browser_page
    page.goto("/progresso")
    page.wait_for_url("**/entrar?next=**")
    expect(page.locator("#auth-form")).to_be_visible()
    expect(
        page.get_by_role("heading", name="Que bom te ver de novo", exact=True)
    ).to_be_visible()


@pytest.mark.parametrize("width", [320, 820, 1440])
def test_responsive_landing_and_account_pages(browser_page, width):
    page = browser_page
    page.set_viewport_size({"width": width, "height": 900})
    page.goto("/")
    expect(page.get_by_role("heading", level=1)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), (
        "Landing overflows"
    )
    beginner(page)
    for path in [
        "/inicio",
        "/aprender",
        "/conversar",
        "/progresso",
        "/perfil",
        "/vocabulario",
        "/revisao",
        "/preferencias",
        "/privacidade",
    ]:
        page.goto(path)
        expect(page.get_by_role("heading", level=1)).to_be_visible()
        assert page.evaluate(
            "document.documentElement.scrollWidth <= window.innerWidth"
        ), f"{path} overflows at {width}px"
