"""Retention CLI processes both private-data families without deleting active tokens."""

from datetime import datetime, timedelta, timezone

from extensions import db
from models import Conversation, Message, PasswordResetToken, User
from services.autenticacao import register
from services.common import iso
from services.conversacao import start


def test_purge_private_data_removes_expired_content_and_old_reset_tokens(app):
    clock = datetime(2026, 1, 10, 12, tzinfo=timezone.utc)
    app.config["NOW"] = lambda: clock
    with app.app_context():
        user = register(
            {
                "name": "Maintenance User",
                "email": "maintenance@example.com",
                "password": "Maintenance123",
                "passwordConfirmation": "Maintenance123",
                "acceptedTerms": True,
            }
        )
        user_id = user.id
        conversation_id = start(user_id, "introductions")["id"]
        db.session.get(Conversation, conversation_id).expires_at = iso(
            clock - timedelta(seconds=1)
        )
        for key, offset in (("old", -2), ("recent", -0.5), ("active", 1)):
            db.session.add(
                PasswordResetToken(
                    id=key,
                    user_id=user_id,
                    token_hash=key,
                    created_at=iso(clock - timedelta(days=3)),
                    expires_at=iso(clock + timedelta(days=offset)),
                )
            )
        db.session.commit()

    result = app.test_cli_runner().invoke(args=["purge-private-data"])
    assert result.exit_code == 0, result.output
    assert "Conversas expiradas processadas: 1" in result.output
    assert "Tokens de recuperação expirados removidos: 1" in result.output
    with app.app_context():
        assert db.session.get(User, user_id) is not None
        assert db.session.get(Conversation, conversation_id).content_deleted_at == iso(
            clock
        )
        assert not db.session.scalar(
            db.select(Message).where(Message.conversation_id == conversation_id)
        )
        assert db.session.get(PasswordResetToken, "old") is None
        assert db.session.get(PasswordResetToken, "recent") is not None
        assert db.session.get(PasswordResetToken, "active") is not None

    again = app.test_cli_runner().invoke(args=["purge-private-data"])
    assert again.exit_code == 0, again.output
    assert "Conversas expiradas processadas: 0" in again.output
    assert "Tokens de recuperação expirados removidos: 0" in again.output
