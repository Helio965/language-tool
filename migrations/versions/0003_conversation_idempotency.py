"""Preserve a committed conversation turn across HTTP response loss."""

from alembic import op
import sqlalchemy as sa

revision = "0003_conversation_idempotency"
down_revision = "0002_integrity_metadata"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    existing = {
        column["name"] for column in sa.inspect(connection).get_columns("messages")
    }
    for column in [
        sa.Column("idempotency_key", sa.String(128)),
        sa.Column("request_fingerprint", sa.String(64)),
        sa.Column("reply_metadata", sa.JSON()),
    ]:
        if column.name not in existing:
            op.add_column("messages", column)
    indexes = {
        index["name"] for index in sa.inspect(connection).get_indexes("messages")
    }
    if "uq_message_conversation_request_role" not in indexes:
        op.create_index(
            "uq_message_conversation_request_role",
            "messages",
            ["conversation_id", "idempotency_key", "role"],
            unique=True,
        )


def downgrade():
    raise RuntimeError(
        "Downgrade destrutivo recusado. Restaure uma cópia validada do banco de origem."
    )
