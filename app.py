"""Flask application factory and Python-only development entry point."""

from pathlib import Path
from urllib.parse import urlencode

import click
from flask import Flask, jsonify, redirect, render_template, request, session
from flask_login import current_user
from flask_wtf.csrf import CSRFError, generate_csrf
from sqlalchemy import event, text
from sqlalchemy.engine import Engine
from werkzeug.exceptions import HTTPException

from config import ROOT, load_config, number
from extensions import csrf, db, limiter, login_manager, migrate
from services.common import AppError


@event.listens_for(Engine, "connect")
def sqlite_foreign_keys(connection, _record):
    if connection.__class__.__module__.startswith("sqlite3"):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


def create_app(config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.update(load_config())
    if isinstance(config, dict):
        app.config.update(config)
    elif config is not None:
        app.config.from_object(config)
    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    db.init_app(app)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)
    from models import User

    migrate.init_app(app, db, directory=str(ROOT / "migrations"))

    @login_manager.user_loader
    def load_user(identity):
        try:
            user_id, version = identity.rsplit(":", 1)
            user = db.session.get(User, user_id)
            return user if user and user.session_version == int(version) else None
        except (ValueError, TypeError):
            return None

    @login_manager.unauthorized_handler
    def unauthorized():
        if request.path.startswith("/api/"):
            raise AppError("UNAUTHENTICATED", "Entre na sua conta para continuar.", 401)
        return redirect("/entrar?" + urlencode({"next": request.full_path.rstrip("?")}))

    @app.before_request
    def bind_account():
        if not request.path.startswith("/api/"):
            return
        if request.path in {"/api/auth/register", "/api/auth/login"}:
            return
        expected = request.headers.get("X-Session-User")
        if expected and (
            not current_user.is_authenticated or expected != current_user.id
        ):
            raise AppError(
                "UNAUTHENTICATED", "A conta desta página mudou. Entre novamente.", 401
            )

    @app.get("/api/csrf")
    def csrf_token():
        return jsonify(csrfToken=generate_csrf())

    @app.get("/api/health")
    def health():
        db.session.execute(text("SELECT 1"))
        ai = app.extensions["english_ai"]
        metadata = (
            ai.metadata()
            if callable(getattr(ai, "metadata", None))
            else {"provider": app.config["AI_PROVIDER"]}
        )
        return jsonify(
            status="ok",
            aiProvider=metadata.get("provider", app.config["AI_PROVIDER"]),
            ai=metadata,
        )

    @app.errorhandler(AppError)
    def domain_error(error):
        db.session.rollback()
        return jsonify(
            error={"code": error.code, "message": error.message, "fields": error.fields}
        ), error.status

    @app.errorhandler(CSRFError)
    def invalid_csrf(_error):
        return jsonify(
            error={"code": "CSRF", "message": "Atualize a página e tente novamente."}
        ), 400

    @app.errorhandler(HTTPException)
    def http_error(error):
        if request.path.startswith("/api/"):
            return jsonify(
                error={"code": str(error.code), "message": "Requisição não permitida."}
            ), error.code
        return render_template(
            "error.html", status=error.code, message="Esta página não está disponível."
        ), error.code

    @app.errorhandler(Exception)
    def unexpected(error):
        db.session.rollback()
        # Log only the exception class: database/provider errors can contain private data.
        app.logger.error("request.failed type=%s", type(error).__name__)
        if request.path.startswith("/api/"):
            return jsonify(
                error={
                    "code": "INTERNAL",
                    "message": "Não foi possível concluir. Tente novamente.",
                }
            ), 500
        return render_template(
            "error.html",
            status=500,
            message="Não foi possível concluir. Tente novamente.",
        ), 500

    @app.after_request
    def headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        if (
            request.path.startswith("/api/")
            or session.get("_user_id")
            or request.path in {"/entrar", "/cadastro", "/recuperar-senha"}
            or request.path.startswith("/redefinir-senha/")
        ):
            response.headers["Cache-Control"] = "no-store"
        return response

    from ai.provider import create_ai_service
    from services.email import init_email

    app.extensions["english_ai"] = create_ai_service(app.config)
    init_email(app)
    from blueprints.auth import bp as auth_bp
    from blueprints.aprendizagem import bp as learning_bp
    from blueprints.conversacao import bp as conversation_bp
    from blueprints.pages import bp as pages_bp

    for bp in [auth_bp, learning_bp, conversation_bp, pages_bp]:
        app.register_blueprint(bp)
    from models.migration import initialize_database, register_migration_cli

    register_migration_cli(app)
    if app.config.get("AUTO_INIT_DB"):
        with app.app_context():
            initialize_database(app)
            from database.seed import seed_content

            seed_content()

    @app.cli.command("seed")
    def seed():
        """Add missing corpus entries without overwriting existing records."""
        from database.seed import seed_content

        seed_content()
        click.echo("Conteúdo pedagógico sincronizado.")

    @app.cli.command("purge-private-data")
    def purge():
        """Apply conversation retention and remove expired password reset tokens."""
        from services.conversacao import purge_expired
        from services.autenticacao import purge_expired_resets

        count = purge_expired()
        reset_count = purge_expired_resets()
        click.echo(f"Conversas expiradas processadas: {count}")
        click.echo(f"Tokens de recuperação expirados removidos: {reset_count}")

    return app


if __name__ == "__main__":
    application = create_app()
    application.run(host="127.0.0.1", port=number("PORT", 5000, 1, 65535), debug=False)
