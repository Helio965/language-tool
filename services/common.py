"""Shared validation, clock and learner context for business services."""

from datetime import datetime, timezone
from math import isfinite
from uuid import uuid4

from flask import current_app, request

from extensions import db


class AppError(Exception):
    def __init__(self, code, message, status=400, fields=None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.fields = fields


APIError = AppError


def now():
    clock = current_app.config.get("NOW")
    return clock() if clock else datetime.now(timezone.utc)


def iso(value):
    return (
        value.astimezone(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def now_iso():
    return iso(now())


def new_id():
    return str(uuid4())


def body():
    try:
        value = request.get_json(silent=True)
    except RecursionError:
        raise AppError("VALIDATION", "O JSON enviado é muito complexo.") from None
    if not isinstance(value, dict):
        raise AppError("VALIDATION", "Envie um objeto JSON válido.")
    # JSON decoding accepts NaN/infinity and escaped lone UTF-16 surrogates.
    # Reject them before password hashing, SQL bindings or other UTF-8 encoding.
    pending = [(value, 0)]
    while pending:
        item, depth = pending.pop()
        if depth > 64:
            raise AppError("VALIDATION", "O JSON enviado é muito complexo.")
        if isinstance(item, str):
            try:
                item.encode("utf-8")
            except UnicodeEncodeError:
                raise AppError("VALIDATION", "Envie texto Unicode válido.") from None
        elif isinstance(item, float) and not isfinite(item):
            raise AppError("VALIDATION", "Envie números finitos no JSON.")
        elif isinstance(item, dict):
            pending.extend((key, depth + 1) for key in item)
            pending.extend((child, depth + 1) for child in item.values())
        elif isinstance(item, list):
            pending.extend((child, depth + 1) for child in item)
    return value


def require_user(user_id):
    from models import User

    user = db.session.get(User, user_id)
    if user is None:
        raise AppError("UNAUTHENTICATED", "Entre na sua conta para continuar.", 401)
    return user


def learner_bundle(user_id):
    from models import LearningProfile, Preferences
    from services.perfil import ensure_account_defaults

    user = require_user(user_id)
    ensure_account_defaults(user_id)
    profile = db.session.get(LearningProfile, user_id)
    preferences = db.session.get(Preferences, user_id)
    if profile is None or preferences is None:
        raise AppError(
            "INCOMPLETE_ACCOUNT", "Não foi possível carregar o perfil da conta.", 409
        )
    level = profile.estimated_level or "beginner"
    language = preferences.explanation_language
    if language == "auto":
        language = "pt" if level in {"beginner", "basic"} else "en"
    learner = {
        "firstName": user.name.split()[0],
        "level": level,
        "goal": profile.goal,
        "interestAreas": profile.interest_areas or [],
        "explanationLanguage": language,
        "correctionIntensity": preferences.correction_intensity,
        "replyLength": preferences.reply_length,
        "showTranslations": bool(
            preferences.show_translations and level in {"beginner", "basic"}
        ),
        "difficulties": profile.difficulties or [],
    }
    return {
        "user": user,
        "profile": profile,
        "preferences": preferences,
        "learner": learner,
    }
