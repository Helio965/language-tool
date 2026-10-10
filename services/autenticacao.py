"""Cadastro, sessão e redefinição com hashes scrypt compatíveis com Node.js."""

import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone
from flask import current_app
from sqlalchemy import delete, update
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import User, PasswordResetToken
from services.common import AppError, now, iso, now_iso, new_id, require_user
from services.perfil import defaults, load_profile, load_preferences

RESET_MESSAGE = (
    "Se existir uma conta com este e-mail, enviaremos as instruções de recuperação."
)
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43}$")


def hash_password(password):
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        dklen=64,
        maxmem=64 * 1024 * 1024,
    )
    return (
        "scrypt$16384$8$1$"
        + base64.b64encode(salt).decode()
        + "$"
        + base64.b64encode(key).decode()
    )


def verify_password(password, stored):
    try:
        scheme, n, r, p, salt, expected = stored.split("$")
        n, r, p = int(n), int(r), int(p)
        if (
            scheme != "scrypt"
            or n < 2
            or n > 262144
            or n & (n - 1)
            or not 1 <= r <= 32
            or not 1 <= p <= 16
        ):
            return False
        salt = base64.b64decode(salt, validate=True)
        expected = base64.b64decode(expected, validate=True)
        if len(salt) != 16 or len(expected) != 64:
            return False
        key = hashlib.scrypt(
            password.encode(),
            salt=salt,
            n=n,
            r=r,
            p=p,
            dklen=64,
            maxmem=64 * 1024 * 1024,
        )
        return hmac.compare_digest(key, expected)
    except (TypeError, ValueError, MemoryError):
        return False


# Equaliza o custo de derivação também quando a conta não existe.
_DUMMY_HASH = hash_password("timing-safety-placeholder-1")


def validate_email(email):
    if not isinstance(email, str) or not email.strip():
        return "Informe seu e-mail."
    if len(email.strip()) > 254 or not EMAIL_PATTERN.fullmatch(email.strip()):
        return "Digite um e-mail válido, como nome@exemplo.com."
    return None


def validate_password_input(data):
    password, confirmation = data.get("password"), data.get("passwordConfirmation")
    errors = {}
    if not isinstance(password, str) or not password:
        errors["password"] = "Crie uma senha."
    elif len(password) > 128:
        errors["password"] = "Use no máximo 128 caracteres."
    elif (
        len(password) < 8
        or not re.search(r"[A-Za-zÀ-ÿ]", password)
        or not re.search(r"\d", password)
    ):
        errors["password"] = "A senha precisa ter 8+ caracteres, com letras e números."
    if not isinstance(confirmation, str) or not confirmation:
        errors["passwordConfirmation"] = "Confirme sua senha."
    elif password != confirmation:
        errors["passwordConfirmation"] = "As senhas não coincidem."
    return errors


def account(user_id):
    user = require_user(user_id)
    profile, preferences = load_profile(user_id), load_preferences(user_id)
    next_step = (
        "onboarding"
        if not profile.onboarding_completed_at
        else (
            "placement"
            if not profile.placement_completed_at or not profile.estimated_level
            else "ready"
        )
    )
    ai = current_app.extensions.get("english_ai")
    provider = getattr(ai, "provider_name", getattr(ai, "providerName", "demo"))
    result = {
        "user": user.to_dict(),
        "profile": profile.to_dict(),
        "preferences": preferences.to_dict(),
        "nextStep": next_step,
        "aiProvider": provider,
    }
    if ai and hasattr(ai, "metadata"):
        result["ai"] = ai.metadata() if callable(ai.metadata) else ai.metadata
    return result


def register(data):
    errors = validate_password_input(data)
    name = data.get("name")
    if not isinstance(name, str) or len(name.strip()) < 2:
        errors["name"] = "O nome precisa ter pelo menos 2 letras."
    elif len(name.strip()) > 80:
        errors["name"] = "Use no máximo 80 caracteres."
    email_error = validate_email(data.get("email"))
    if email_error:
        errors["email"] = email_error
    if data.get("acceptedTerms") is not True:
        errors["acceptedTerms"] = (
            "Para continuar, aceite os termos e a política de privacidade."
        )
    if errors:
        raise AppError("VALIDATION", "Dados inválidos.", fields=errors)
    email = data["email"].strip().lower()
    if db.session.scalar(db.select(User).where(User.email == email)):
        raise AppError(
            "EMAIL_IN_USE",
            "Já existe uma conta com este e-mail.",
            status=409,
            fields={"email": "Já existe uma conta com este e-mail. Que tal entrar?"},
        )
    timestamp = now_iso()
    user = User(
        id=new_id(),
        name=name.strip(),
        email=email,
        password_hash=hash_password(data["password"]),
        role="user",
        created_at=timestamp,
        terms_accepted_at=timestamp,
        session_version=0,
    )
    profile, preferences = defaults(user.id)
    try:
        db.session.add(user)
        db.session.flush()
        db.session.add_all([profile, preferences])
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        raise AppError(
            "EMAIL_IN_USE", "Já existe uma conta com este e-mail.", status=409
        ) from None
    except Exception:
        db.session.rollback()
        raise
    return user


def login(data):
    errors = {}
    email_error = validate_email(data.get("email"))
    if email_error:
        errors["email"] = email_error
    if (
        not isinstance(data.get("password"), str)
        or not data["password"]
        or len(data["password"]) > 256
    ):
        errors["password"] = "Informe sua senha."
    if errors:
        raise AppError("VALIDATION", "Dados inválidos.", fields=errors)
    user = db.session.scalar(
        db.select(User).where(User.email == data["email"].strip().lower())
    )
    valid = verify_password(
        data["password"], user.password_hash if user else _DUMMY_HASH
    )
    if not user or not valid:
        raise AppError(
            "INVALID_CREDENTIALS",
            "E-mail ou senha incorretos. Tente novamente.",
            status=401,
        )
    return user


def revoke_sessions(user_id):
    db.session.execute(
        update(User)
        .where(User.id == user_id)
        .values(session_version=User.session_version + 1)
    )
    db.session.commit()


def delete_account(user_id, password):
    user = require_user(user_id)
    if not isinstance(password, str) or not verify_password(
        password, user.password_hash
    ):
        raise AppError(
            "VALIDATION", "Senha incorreta.", fields={"password": "Senha incorreta."}
        )
    db.session.execute(delete(User).where(User.id == user_id))
    db.session.commit()


def request_reset(email):
    error = validate_email(email)
    if error:
        raise AppError("VALIDATION", "Dados inválidos.", fields={"email": error})
    user = db.session.scalar(
        db.select(User).where(User.email == email.strip().lower()).with_for_update()
    )
    if not user:
        return None
    timestamp = now()
    latest = db.session.scalar(
        db.select(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id)
        .order_by(PasswordResetToken.created_at.desc())
        .limit(1)
    )
    if latest and not latest.used_at:
        created = datetime.fromisoformat(latest.created_at.replace("Z", "+00:00"))
        expires = datetime.fromisoformat(latest.expires_at.replace("Z", "+00:00"))
        if timestamp - created < timedelta(seconds=60) and timestamp < expires:
            return None
    token = secrets.token_urlsafe(32)
    ttl = current_app.config.get("PASSWORD_RESET_TTL_MINUTES", 15)
    db.session.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
    )
    db.session.add(
        PasswordResetToken(
            id=new_id(),
            user_id=user.id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            created_at=iso(timestamp),
            expires_at=iso(timestamp + timedelta(minutes=ttl)),
        )
    )
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return {"user": user, "token": token, "expiresInMinutes": ttl}


def inspect_reset(token):
    if not isinstance(token, str) or not TOKEN_PATTERN.fullmatch(token):
        return "invalid", None
    record = db.session.scalar(
        db.select(PasswordResetToken).where(
            PasswordResetToken.token_hash == hashlib.sha256(token.encode()).hexdigest()
        )
    )
    if not record or not db.session.get(User, record.user_id):
        return "invalid", None
    if record.used_at:
        return "used", record
    if now() >= datetime.fromisoformat(record.expires_at.replace("Z", "+00:00")):
        return "expired", record
    return "valid", record


def reset_password(data):
    status, record = inspect_reset(data.get("token"))
    if status != "valid":
        raise AppError(
            "RESET_TOKEN_INVALID",
            "Este link de redefinição não é mais válido. Peça um novo link.",
        )
    errors = validate_password_input(data)
    if errors:
        raise AppError("VALIDATION", "Dados inválidos.", fields=errors)
    password_hash = hash_password(data["password"])
    user_id = record.user_id
    try:
        consumed = db.session.execute(
            update(PasswordResetToken)
            .where(
                PasswordResetToken.id == record.id,
                PasswordResetToken.used_at.is_(None),
                PasswordResetToken.expires_at > now_iso(),
            )
            .values(used_at=now_iso())
        )
        if consumed.rowcount != 1:
            raise AppError("RESET_TOKEN_INVALID", "Link de redefinição já utilizado.")
        changed = db.session.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                password_hash=password_hash, session_version=User.session_version + 1
            )
        )
        if changed.rowcount != 1:
            raise AppError("RESET_TOKEN_INVALID", "Link de redefinição inválido.")
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return user_id


def purge_expired_resets():
    result = db.session.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.expires_at < iso(now() - timedelta(days=1))
        )
    )
    db.session.commit()
    return result.rowcount
