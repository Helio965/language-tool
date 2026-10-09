"""Environment configuration without reading or logging credential contents."""
import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent


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


def load_config():
    load_dotenv(ROOT / ".env", override=False)
    environment = os.environ.get("APP_ENV", "development")
    if environment not in {"development", "production", "testing"}:
        raise ValueError("APP_ENV inválido.")
    production = environment == "production"
    secret = os.environ.get("SECRET_KEY") or os.environ.get("AUTH_TOKEN_SECRET")
    if production and (not secret or len(secret) < 32):
        raise ValueError("Produção exige SECRET_KEY com pelo menos 32 caracteres.")
    database_url = os.environ.get("DATABASE_URL") or f"sqlite:///{ROOT / 'instance' / 'english-ai.db'}"
    if database_url.startswith("postgres://"):
        database_url = "postgresql://" + database_url[len("postgres://"):]
    config = {
        "APP_ENV": environment,
        "SECRET_KEY": secret or secrets.token_hex(32),
        "SQLALCHEMY_DATABASE_URI": database_url,
        "SQLALCHEMY_TRACK_MODIFICATIONS": False,
        "SESSION_COOKIE_NAME": "english_ai_session",
        "SESSION_COOKIE_HTTPONLY": True,
        "SESSION_COOKIE_SECURE": production,
        "SESSION_COOKIE_SAMESITE": "Strict",
        "PERMANENT_SESSION_LIFETIME": timedelta(hours=number("AUTH_TOKEN_TTL_HOURS", 72, 1, 720)),
        "SESSION_REFRESH_EACH_REQUEST": False,
        "MAX_CONTENT_LENGTH": 16 * 1024,
        "WTF_CSRF_HEADERS": ["X-CSRFToken", "X-CSRF-Token"],
        "WTF_CSRF_TIME_LIMIT": timedelta(hours=1),
        "AUTO_INIT_DB": not production,
        "TIME_ZONE": "America/Sao_Paulo",
        "RATELIMIT_STORAGE_URI": os.environ.get("RATELIMIT_STORAGE_URI", "memory://"),
        "RATELIMIT_HEADERS_ENABLED": True,
        "AI_PROVIDER": os.environ.get("AI_PROVIDER", "mock"),
        "ANTHROPIC_API_KEY": os.environ.get("ANTHROPIC_API_KEY", ""),
        "ANTHROPIC_MODEL": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        "AI_EFFORT": os.environ.get("AI_EFFORT", "low"),
        "AI_TIMEOUT_MS": number("AI_TIMEOUT_MS", 20000, 1000, 120000),
        "AI_MAX_HISTORY_MESSAGES": number("AI_MAX_HISTORY_MESSAGES", 12, 2, 50),
        "CONVERSATION_RETENTION_DAYS": number("CONVERSATION_RETENTION_DAYS", 90, 1, 3650),
        "PASSWORD_RESET_TTL_MINUTES": number("PASSWORD_RESET_TTL_MINUTES", 15, 5, 120),
        "MAIL_TRANSPORT": os.environ.get("MAIL_TRANSPORT") or ("smtp" if os.environ.get("SMTP_HOST") else "disabled" if production else "outbox"),
        "MAIL_OUTBOX_DIR": os.environ.get("MAIL_OUTBOX_DIR") or str(ROOT / "instance" / "outbox"),
        "SMTP_HOST": os.environ.get("SMTP_HOST", ""),
        "SMTP_PORT": number("SMTP_PORT", 587, 1, 65535),
        "SMTP_SECURE": flag("SMTP_SECURE"),
        "SMTP_USER": os.environ.get("SMTP_USER", ""),
        "SMTP_PASSWORD": os.environ.get("SMTP_PASSWORD", ""),
        "MAIL_FROM": os.environ.get("MAIL_FROM") or "English AI <no-reply@english-ai.local>",
        "APP_PUBLIC_URL": os.environ.get("APP_PUBLIC_URL") or "http://localhost:5000",
        "DEBUG": False,
    }
    if config["AI_PROVIDER"] not in {"mock", "demo", "anthropic"}:
        raise ValueError("AI_PROVIDER precisa ser mock, demo ou anthropic.")
    if production and config["MAIL_TRANSPORT"] == "outbox":
        raise ValueError("A caixa de saída local é exclusiva do desenvolvimento.")
    return config
