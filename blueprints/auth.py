"""Contratos HTTP preservados; validações e transações ficam nos serviços."""

from flask import Blueprint, current_app, jsonify, session
from flask_login import current_user, login_required, login_user, logout_user
from extensions import limiter
from services.common import body
from services import autenticacao, perfil

bp = Blueprint("auth", __name__, url_prefix="/api")
auth_limit = limiter.shared_limit("20 per 15 minutes", scope="authentication")
reset_limit = limiter.shared_limit("10 per 15 minutes", scope="password-reset")


def start_session(user):
    session.clear()
    login_user(user)
    session.permanent = True


@bp.post("/auth/register")
@auth_limit
def register():
    user = autenticacao.register(body())
    start_session(user)
    current_app.extensions["email_service"].send_welcome(user)
    return jsonify(autenticacao.account(user.id)), 201


@bp.post("/auth/login")
@auth_limit
def login():
    user = autenticacao.login(body())
    start_session(user)
    return jsonify(autenticacao.account(user.id))


@bp.post("/auth/logout")
def logout():
    if current_user.is_authenticated:
        autenticacao.revoke_sessions(current_user.id)
    logout_user()
    session.clear()
    return "", 204


@bp.get("/auth/session")
def inspect_session():
    if not current_user.is_authenticated:
        if session.get("_user_id"):
            logout_user()
            session.clear()
        return jsonify(account=None)
    return jsonify(account=autenticacao.account(current_user.id))


@bp.get("/me")
@login_required
def me():
    return jsonify(autenticacao.account(current_user.id))


@bp.delete("/me")
@login_required
@auth_limit
def delete_account():
    autenticacao.delete_account(current_user.id, body().get("password"))
    logout_user()
    session.clear()
    return "", 204


@bp.put("/me/profile")
@login_required
def save_profile():
    return jsonify(perfil.save_profile(current_user.id, body()))


@bp.get("/me/preferences")
@login_required
def preferences():
    return jsonify(perfil.load_preferences(current_user.id).to_dict())


@bp.patch("/me/preferences")
@login_required
def update_preferences():
    return jsonify(perfil.update_preferences(current_user.id, body()))


@bp.post("/auth/password-reset")
@reset_limit
def request_reset():
    reset = autenticacao.request_reset(body().get("email"))
    if reset:
        current_app.extensions["email_service"].send_password_reset(
            reset["user"], reset["token"], reset["expiresInMinutes"]
        )
    return jsonify(
        message=autenticacao.RESET_MESSAGE,
        expiresInMinutes=current_app.config["PASSWORD_RESET_TTL_MINUTES"],
    ), 202


@bp.post("/auth/password-reset/verify")
def verify_reset():
    status, _ = autenticacao.inspect_reset(body().get("token"))
    return jsonify(status=status)


@bp.post("/auth/password-reset/confirm")
@auth_limit
def confirm_reset():
    prior_user = current_user.id if current_user.is_authenticated else None
    user_id = autenticacao.reset_password(body())
    session_ended = prior_user == user_id
    if session_ended:
        logout_user()
        session.clear()
    return jsonify(message="Senha redefinida com sucesso.", sessionEnded=session_ended)
