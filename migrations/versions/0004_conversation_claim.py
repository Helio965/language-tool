"""Reserve a short conversation lease before an external generation call."""

from alembic import op
import sqlalchemy as sa

revision = "0004_conversation_claim"
down_revision = "0003_conversation_idempotency"
branch_labels = None
depends_on = None


def upgrade():
    existing = {
        column["name"]
        for column in sa.inspect(op.get_bind()).get_columns("conversations")
    }
    for column in (
        sa.Column("pending_request_nonce", sa.String(36)),
        sa.Column("pending_request_expires_at", sa.String()),
    ):
        if column.name not in existing:
            op.add_column("conversations", column)


def downgrade():
    raise RuntimeError(
        "Downgrade destrutivo recusado. Restaure uma cópia validada do banco de origem."
    )
