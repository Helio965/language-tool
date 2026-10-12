"""Shared extensions, bound to each application by its factory."""

from flask import current_app, has_app_context, has_request_context
from flask_limiter import Limiter, RequestLimit
from flask_limiter.util import get_remote_address
from flask_login import LoginManager, current_user
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect
from limits import parse
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])
migrate = Migrate()


def consume_paid_ai_quota():
    """Reserve one provider attempt, after local validation and cache decisions.

    Each ``hit`` atomically reserves its counter. The three reservations are
    deliberately conservative: a later refusal can leave earlier reservations
    consumed. Never refund after an upstream failure, whose cost is uncertain.
    Stable scopes share limits across routes, sessions and production workers.
    No route decorators/context managers are installed by this function.
    """
    if not has_app_context() or not has_request_context():
        return
    config = current_app.config
    if config.get("AI_PROVIDER") != "anthropic":
        return
    if not config.get("RATELIMIT_ENABLED", True):
        return

    from services.common import AppError

    if not current_user.is_authenticated:
        raise AppError("UNAUTHENTICATED", "Entre na sua conta para continuar.", 401)
    quotas = (
        (
            f"{config.get('AI_MINUTE_REQUEST_LIMIT', 10)} per minute",
            f"user:{current_user.id}",
            "external-ai-minute-account",
        ),
        (
            f"{config.get('AI_DAILY_REQUEST_LIMIT', 100)} per day",
            f"user:{current_user.id}",
            "external-ai-daily-account",
        ),
        (
            f"{config.get('AI_GLOBAL_DAILY_REQUEST_LIMIT', 1000)} per day",
            "all-accounts",
            "external-ai-daily-global",
        ),
    )
    try:
        # A middleware fallback must never silently multiply a paid budget by
        # the number of workers when the configured shared store is unavailable.
        if getattr(limiter, "_storage_dead", False):
            raise RuntimeError("Shared quota storage unavailable")
        strategy = limiter.limiter
        prefix = config.get("RATELIMIT_KEY_PREFIX", "")
        for specification, account, scope in quotas:
            identifiers = (prefix, account, scope) if prefix else (account, scope)
            item = parse(specification)
            if not strategy.hit(item, *identifiers):
                # Report the actual exhausted paid window in Retry-After and
                # rate-limit headers, without registering limits on the route.
                limiter.context.view_rate_limit = RequestLimit(
                    limiter, item, list(identifiers), breached=True, shared=True
                )
                raise AppError(
                    "RATE_LIMITED",
                    "O limite de solicitações de IA foi atingido. Aguarde e tente novamente.",
                    429,
                )
    except AppError:
        raise
    except Exception as exc:
        # Do not include backend URIs, credentials or exception bodies in HTTP.
        raise AppError(
            "AI_UNAVAILABLE",
            "Não foi possível verificar o limite de IA. Tente novamente mais tarde.",
            503,
        ) from exc
