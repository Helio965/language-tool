"""Environment configuration without reading or logging credential contents."""

import os
import secrets
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent

# Keep environment loading and final factory overrides subject to the same
# operational bounds. Boolean values are not integer budgets.
AI_INTEGER_BOUNDS = {
    "AI_TIMEOUT_MS": (20000, 1000, 120000),
    "AI_MAX_OUTPUT_TOKENS": (1024, 256, 2048),
    "AI_MAX_CONTEXT_CHARS": (8000, 2048, 12000),
    "AI_MINUTE_REQUEST_LIMIT": (10, 1, 120),
    "AI_DAILY_REQUEST_LIMIT": (100, 10, 2000),
    "AI_GLOBAL_DAILY_REQUEST_LIMIT": (1000, 10, 100000),
    "AI_MAX_HISTORY_MESSAGES": (12, 2, 50),
}


class _EphemeralSessionSecret(str):
    """A signer-compatible development key that cannot be promoted to production."""


def flag(name, default=False):
    value = os.environ.get(name)
    if not value:
        return default
    if value.lower() not in {"true", "false", "1", "0"}:
        raise ValueError(f"{name} precisa ser true ou false.")
    return value.lower() in {"true", "1"}


def number(name, default, minimum, maximum):
    try:
        value = int(os.environ.get(name) or default)
    except ValueError as exc:
        raise ValueError(f"{name} precisa ser um número inteiro.") from exc
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} fora do intervalo permitido.")
    return value


def validate_effective_config(config):
    """Validate the final factory configuration, including explicit overrides."""
    if config.get("APP_ENV") != "production":
        return
    secret = config.get("SECRET_KEY")
    if isinstance(secret, _EphemeralSessionSecret):
        raise ValueError("Produção exige SECRET_KEY configurada explicitamente.")
    if not isinstance(secret, (str, bytes)) or len(secret) < 32:
        raise ValueError("Produção exige SECRET_KEY com pelo menos 32 caracteres.")
    if config.get("DEBUG"):
        raise ValueError("Produção exige DEBUG desabilitado.")
    if config.get("SESSION_COOKIE_SECURE") is not True:
        raise ValueError("Produção exige SESSION_COOKIE_SECURE habilitado.")
    if config.get("SESSION_COOKIE_HTTPONLY") is not True:
        raise ValueError("Produção exige SESSION_COOKIE_HTTPONLY habilitado.")
    same_site = config.get("SESSION_COOKIE_SAMESITE")
    if not isinstance(same_site, str) or same_site.casefold() != "strict":
        raise ValueError("Produção exige SESSION_COOKIE_SAMESITE=Strict.")
    if config.get("WTF_CSRF_ENABLED", True) is not True:
        raise ValueError("Produção exige proteção CSRF habilitada.")
    if config.get("MAIL_TRANSPORT") == "outbox":
        raise ValueError("A caixa de saída local é exclusiva do desenvolvimento.")
    if config.get("RATELIMIT_ENABLED", True) is not True:
        raise ValueError("Produção exige limites de solicitações habilitados.")
    for name, (default, minimum, maximum) in AI_INTEGER_BOUNDS.items():
        value = config.get(name, default)
        if type(value) is not int or not minimum <= value <= maximum:
            raise ValueError(
                f"Produção exige {name} inteiro entre {minimum} e {maximum}."
            )
    if config.get("AI_PROVIDER") != "anthropic":
        return
    uri = config.get("RATELIMIT_STORAGE_URI", "")
    try:
        parsed = urlsplit(uri)
    except (TypeError, ValueError):
        raise ValueError(
            "Produção com IA paga exige um armazenamento Redis compartilhado válido."
        ) from None
    shared = parsed.scheme in {"redis", "rediss", "redis+unix"}
    if not shared or not (
        parsed.path if parsed.scheme == "redis+unix" else parsed.hostname
    ):
        raise ValueError(
            "Produção com IA paga exige RATELIMIT_STORAGE_URI compartilhado, como redis://."
        )
    if config.get("RATELIMIT_IN_MEMORY_FALLBACK_ENABLED") or config.get(
        "RATELIMIT_IN_MEMORY_FALLBACK"
    ):
        raise ValueError(
            "Produção com IA paga não permite fallback local para os limites de solicitações."
        )
    if config.get("RATELIMIT_SWALLOW_ERRORS"):
        raise ValueError(
            "Produção com IA paga não permite ignorar falhas do armazenamento de limites."
        )


def load_config():
    load_dotenv(ROOT / ".env", override=False)
    environment = os.environ.get("APP_ENV", "development")
    if environment not in {"development", "production", "testing"}:
        raise ValueError("APP_ENV inválido.")
    production = environment == "production"
    secret = os.environ.get("SECRET_KEY") or os.environ.get("AUTH_TOKEN_SECRET")
    if production and (not secret or len(secret) < 32):
        raise ValueError("Produção exige SECRET_KEY com pelo menos 32 caracteres.")
    database_url = (
        os.environ.get("DATABASE_URL")
        or f"sqlite:///{ROOT / 'instance' / 'english-ai.db'}"
    )
    if database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url[len("postgres://") :]
    config = {
        "APP_ENV": environment,
        "SECRET_KEY": secret or _EphemeralSessionSecret(secrets.token_hex(32)),
        "SQLALCHEMY_DATABASE_URI": database_url,
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SESSION_COOKIE_NAME": "english_ai_session",
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SECURE": production,
        "SESSION_COOKIE_SAMESITE": "Strict",
        "PERMANENT_SESSION_LIFETIME": timedelta(
            hours=number("AUTH_TOKEN_TTL_HOURS", 72, 1, 720)
        ),
        "SESSION_REFRESH_EACH_REQUEST": False,
        "MAX_CONTENT_LENGTH": 16 * 1024,
        "WTF_CSRF_HEADERS": ["X-CSRFToken", "X-CSRF-Token"],
        "WTF_CSRF_TIME_LIMIT": 3600,
        "AUTO_INIT_DB": flag("AUTO_INIT_DB", not production),
        "TIME_ZONE": "America/Sao_Paulo",
        "RATELIMIT_STORAGE_URI": os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
        "RATELIMIT_ENABLED": True,
        "RATELIMIT_HEADERS_ENABLED": True,
        "AI_PROVIDER": os.environ.get("AI_PROVIDER", "mock"),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
        "ANTHROPIC_MODEL": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        "AI_EFFORT": os.environ.get("AI_EFFORT", "low"),
        **{
            name: number(name, default, minimum, maximum)
            for name, (default, minimum, maximum) in AI_INTEGER_BOUNDS.items()
        },
        "CONVERSATION_RETENTION_DAYS": number(
            "CONVERSATION_RETENTION_DAYS", 90, 1, 3650
        ),
        "PASSWORD_RESET_TTL_MINUTES": number("PASSWORD_RESET_TTL_MINUTES", 15, 5, 120),
        "MAIL_TRANSPORT": os.environ.get("MAIL_TRANSPORT")
        or (
            "smtp"
            if os.environ.get("SMTP_HOST")
            else "disabled"
            if production
            else "outbox"
        ),
        "MAIL_OUTBOX_DIR": os.environ.get("MAIL_OUTBOX_DIR")
        or str(ROOT / "instance" / "outbox"),
        "SMTP_HOST": os.environ.get("SMTP_HOST", ""),
        "SMTP_PORT": number("SMTP_PORT", 587, 1, 65535),
        "SMTP_SECURE": flag("SMTP_SECURE"),
        "SMTP_USER": os.environ.get("SMTP_USER", ""),
        "SMTP_PASSWORD": os.environ.get("SMTP_PASSWORD", ""),
        "MAIL_FROM": os.environ.get("MAIL_FROM")
        or "English AI <no-reply@english-ai.local>",
        "APP_PUBLIC_URL": os.environ.get("APP_PUBLIC_URL") or "http://localhost:5000",
        "DEBUG": False,
    }
    if config["AI_PROVIDER"] not in {"mock", "demo", "anthropic"}:
        raise ValueError("AI_PROVIDER precisa ser mock, demo ou anthropic.")
    if production and config["MAIL_TRANSPORT"] == "outbox":
        raise ValueError("A caixa de saída local é exclusiva do desenvolvimento.")
    validate_effective_config(config)
    return config
