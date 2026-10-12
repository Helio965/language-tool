"""Responsive product pages, unavailable reminders and honest lesson provenance."""

import pytest
from playwright.sync_api import expect
from test_journeys import web, browser_page, beginner
from extensions import db
from models import Preferences

pytestmark = pytest.mark.browser


@pytest.mark.parametrize(
    "width,height", [(1920, 1080), (1366, 768), (768, 1024), (390, 844), (360, 800)]
)
def test_responsive_public_and_private_navigation(browser_page, width, height):
    page = browser_page
    page.set_viewport_size({"width": width, "height": height})
    for path in [
        "/",
        "/cadastro",
        "/entrar",
        "/recuperar-senha",
        "/termos-e-privacidade",
    ]:
        response = page.goto(path)
        assert response.status == 200
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("heading", level=1)).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), path
    beginner(page)
    for path in [
        "/inicio",
        "/aprender",
        "/conversar",
        "/progresso",
        "/perfil",
        "/preferencias",
        "/privacidade",
        "/vocabulario",
        "/revisao",
        "/aprender/aula/greetings",
        "/perfil/editar",
        "/perfil/nivelamento",
    ]:
        response = page.goto(path)
        assert response.status == 200
        page.wait_for_load_state("networkidle")
        expect(page.get_by_role("heading", level=1)).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), path
    page.goto("/perfil")
    # Both desktop and mobile navigation communicate the active page.
    assert page.locator('a[aria-current="page"][href="/perfil"]').count() == 2


def test_unavailable_reminders_preserve_legacy_value_and_other_preferences(
    browser_page, web
):
    page = browser_page
    beginner(page)
    app = web["app"]
    with app.app_context():
        preferences = db.session.scalar(db.select(Preferences))
        preferences.study_reminders = True
        db.session.commit()
    page.goto("/preferencias")
    reminder = page.get_by_role("checkbox", name="Lembretes de estudo")
    expect(reminder).to_be_disabled()
    expect(reminder).to_be_checked()
    expect(page.locator("#reminder-unavailable")).to_contain_text(
        "Nenhuma notificação é enviada"
    )
    with page.expect_response("**/api/me/preferences") as saved:
        page.get_by_text("20 min", exact=True).click()
    assert saved.value.status == 200
    page.reload()
    expect(page.get_by_role("radio", name="20 min", exact=True)).to_be_checked()
    expect(reminder).to_be_disabled()
    expect(reminder).to_be_checked()


def test_lesson_extra_output_identifies_demonstration_in_immersive_layout(browser_page):
    page = browser_page
    beginner(page)
    page.goto("/aprender/aula/greetings")
    page.locator("#lesson-start").click()
    page.locator("#lesson-explain").click()
    expect(page.locator("#lesson-extra")).to_contain_text(
        "Demonstração · roteiro local"
    )
    page.locator("#lesson-next").click()
    page.locator("#lesson-example").click()
    expect(page.locator("#lesson-examples")).to_contain_text(
        "Demonstração · roteiro local"
    )


def test_escape_only_returns_focus_when_mobile_menu_was_open(browser_page):
    page = browser_page
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto("/")
    button = page.locator("#landing-menu-button")
    signup = page.get_by_role("link", name="Começar a aprender", exact=True)
    signup.focus()
    page.keyboard.press("Escape")
    expect(signup).to_be_focused()
    button.click()
    expect(button).to_have_attribute("aria-expanded", "true")
    page.keyboard.press("Escape")
    expect(button).to_have_attribute("aria-expanded", "false")
    expect(button).to_be_focused()
