"""Shared extensions, bound to each application by its factory."""

from flask import current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_login import LoginManager, current_user
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_wtf import CSRFProtect
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
login_manager = LoginManager()
csrf = CSRFProtect()
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])
migrate = Migrate()


def ai_account_key():
    return f"user:{current_user.id}" if current_user.is_authenticated else f"ip:{get_remote_address()}"


ai_daily_limit = limiter.shared_limit(
    lambda: (
        f"{current_app.config.get('AI_DAILY_REQUEST_LIMIT', 100)} per day"
        if current_app.config.get("AI_PROVIDER") == "anthropic"
        else "100000 per day"
    ),
    scope="external-ai-daily-account",
    key_func=ai_account_key,
)
ai_minute_limit = limiter.shared_limit(
    "10 per minute", scope="external-ai-minute-account", key_func=ai_account_key
)


# Account quotas alone cannot constrain total spending if an attacker creates
# many accounts. This deployment-wide limit shares one key across all accounts
# and all paid-AI endpoints. Use a shared storage backend in production.
ai_global_daily_limit = limiter.shared_limit(
    lambda: (
        f"{current_app.config.get('AI_GLOBAL_DAILY_REQUEST_LIMIT', 1000)} per day"
        if current_app.config.get("AI_PROVIDER") == "anthropic"
        else "1000000 per day"
    ),
    scope="external-ai-daily-global",
    key_func=lambda: "all-accounts",
)
