from sqlalchemy import text
from extensions import db
from .base import PublicModel


class Conversation(PublicModel, db.Model):
    __tablename__ = "conversations"
    __table_args__ = (
        db.CheckConstraint(
            "retention IN ('saved', 'ephemeral')", name="ck_conversation_retention"
        ),
        db.Index("idx_conversations_user_updated", "user_id", "updated_at"),
        db.Index(
            "idx_conversations_expiry",
            "expires_at",
            sqlite_where=text("content_deleted_at IS NULL"),
            postgresql_where=text("content_deleted_at IS NULL"),
        ),
    )
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    topic_id = db.Column(db.String, nullable=False)
    title = db.Column(db.String, nullable=False)
    level_at_start = db.Column(db.String, nullable=False)
    context = db.Column(db.JSON, nullable=False)
    retention = db.Column(db.String, nullable=False)
    expires_at = db.Column(db.String)
    user_message_count = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    corrected_skills = db.Column(
        db.JSON, nullable=False, default=list, server_default="[]"
    )
    content_deleted_at = db.Column(db.String)
    created_at = db.Column(db.String, nullable=False)
    updated_at = db.Column(db.String, nullable=False)
    ended_at = db.Column(db.String)


class Message(PublicModel, db.Model):
    __tablename__ = "messages"
    __table_args__ = (
        db.CheckConstraint("role IN ('user', 'assistant')", name="ck_message_role"),
        db.Index("idx_messages_conversation_created", "conversation_id", "created_at"),
        db.Index(
            "uq_message_conversation_request_role",
            "conversation_id",
            "idempotency_key",
            "role",
            unique=True,
        ),
    )
    hidden_fields = frozenset(
        {
            "provider",
            "generation_mode",
            "model",
            "idempotency_key",
            "request_fingerprint",
            "reply_metadata",
        }
    )
    id = db.Column(db.String, primary_key=True)
    conversation_id = db.Column(
        db.String, db.ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False
    )
    role = db.Column(db.String, nullable=False)
    content = db.Column(db.String, nullable=False)
    translation = db.Column(db.String)
    corrections = db.Column(db.JSON, nullable=False, default=list, server_default="[]")
    deferred_corrections = db.Column(
        db.JSON, nullable=False, default=list, server_default="[]"
    )
    notices = db.Column(db.JSON, nullable=False, default=list, server_default="[]")
    created_at = db.Column(db.String, nullable=False)
    provider = db.Column(db.String(24))
    generation_mode = db.Column(db.String(24))
    model = db.Column(db.String(120))
    idempotency_key = db.Column(db.String(128))
    request_fingerprint = db.Column(db.String(64))
    reply_metadata = db.Column(db.JSON)

    def to_dict(self):
        result = super().to_dict()
        if self.provider:
            result["ai"] = {
                "provider": self.provider,
                "mode": self.generation_mode,
                "model": self.model,
            }
        return result
