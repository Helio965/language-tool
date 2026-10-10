"""Jinja pages. Browser interactions use the same protected Python API contracts."""

from flask import Blueprint, redirect, render_template, request, url_for
from flask_login import current_user

bp = Blueprint("pages", __name__)

STEP_PATH = {
    "onboarding": "/configuracao",
    "placement": "/nivelamento",
    "ready": "/inicio",
}


def _account():
    if not current_user.is_authenticated:
        return None
    from services.autenticacao import account

    return account(current_user.id)


def _show(
    template, title, page, *, private=False, step="ready", public_only=False, **context
):
    account = _account()
    if public_only and account:
        return redirect(STEP_PATH[account["nextStep"]])
    if private and not account:
        return redirect(url_for("pages.login", next=request.full_path.rstrip("?")))
    if private and account and account["nextStep"] != step:
        # Editing/retaking are available only after the first-access steps.
        return redirect(STEP_PATH[account["nextStep"]])
    return render_template(template, title=title, page=page, account=account, **context)


@bp.get("/")
def landing():
    from content import catalog

    lessons = catalog.lessons()
    counts = {
        "lessons": len(lessons),
        "exercises": sum(len(x["exercises"]) for x in lessons),
        "topics": len(catalog.topics()),
        "words": len(catalog.vocabulary()),
    }
    return _show(
        "landing.html",
        "Aprenda inglês com IA",
        "landing",
        public_only=True,
        counts=counts,
    )


@bp.get("/entrar")
def login():
    return _show("auth/form.html", "Entrar", "login", public_only=True)


@bp.get("/cadastro")
def register():
    return _show("auth/form.html", "Criar conta", "register", public_only=True)


@bp.get("/recuperar-senha")
def forgot():
    return _show("auth/form.html", "Recuperar senha", "forgot", public_only=True)


@bp.get("/redefinir-senha/<token>")
def reset(token):
    return _show("auth/form.html", "Redefinir senha", "reset", token=token)


@bp.get("/termos-e-privacidade")
def terms():
    return _show("legal.html", "Termos de uso e privacidade", "terms")


@bp.get("/configuracao")
def onboarding():
    return _show(
        "perfil/onboarding.html",
        "Configuração inicial",
        "onboarding",
        private=True,
        step="onboarding",
        immersive=True,
    )


@bp.get("/nivelamento")
def placement():
    return _show(
        "aprender/placement.html",
        "Nivelamento",
        "placement",
        private=True,
        step="placement",
        immersive=True,
    )


@bp.get("/perfil/editar")
def edit_profile():
    return _show(
        "perfil/onboarding.html",
        "Editar perfil de aprendizagem",
        "onboarding",
        private=True,
        editing=True,
        immersive=True,
    )


@bp.get("/perfil/nivelamento")
def retake():
    return _show(
        "aprender/placement.html",
        "Refazer nivelamento",
        "placement",
        private=True,
        editing=True,
        immersive=True,
    )


@bp.get("/aprender/aula/<lesson_id>")
def lesson(lesson_id):
    return _show(
        "aprender/lesson.html",
        "Aula",
        "lesson",
        private=True,
        resource_id=lesson_id,
        immersive=True,
        mode="learn",
    )


@bp.get("/conversar/<conversation_id>")
def conversation(conversation_id):
    return _show(
        "conversar/chat.html",
        "Conversa",
        "chat",
        private=True,
        resource_id=conversation_id,
        immersive=True,
        mode="talk",
    )


@bp.get("/revisao/<review_id>")
def review_session(review_id):
    return _show(
        "exercicios/review.html",
        "Sessão de revisão",
        "review_session",
        private=True,
        resource_id=review_id,
        immersive=True,
        mode="learn",
    )


def _register_page(path, endpoint, title, page, template="feature.html", mode=None):
    def view():
        return _show(template, title, page, private=True, mode=mode)

    bp.add_url_rule(path, endpoint, view, methods=["GET"])


for args in [
    ("/inicio", "home", "Início", "home"),
    (
        "/aprender",
        "learn",
        "Sua trilha de aprendizado",
        "learn",
        "feature.html",
        "learn",
    ),
    (
        "/conversar",
        "conversation_hub",
        "Converse em inglês, sem medo de errar",
        "conversation_hub",
        "feature.html",
        "talk",
    ),
    ("/vocabulario", "vocabulary", "Vocabulário", "vocabulary"),
    ("/revisao", "reviews", "Revisão", "reviews"),
    ("/progresso", "progress", "Seu progresso", "progress"),
    ("/perfil", "profile", "Perfil", "profile", "perfil/profile.html"),
    (
        "/preferencias",
        "preferences",
        "Preferências",
        "preferences",
        "configuracoes/preferences.html",
    ),
    (
        "/privacidade",
        "privacy",
        "Privacidade e dados",
        "privacy",
        "configuracoes/privacy.html",
    ),
]:
    _register_page(*args)


@bp.get("/app")
def app_alias():
    return redirect("/inicio")
