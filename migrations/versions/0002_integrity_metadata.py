"""Persist retry/session boundaries and identify generated assistant content."""

from alembic import op
import sqlalchemy as sa

revision = "0002_integrity_metadata"
down_revision = "0001_legacy_schema"
branch_labels = None
depends_on = None


def upgrade():
    connection = op.get_bind()
    columns = {
        "progress": [
            sa.Column("passage_id", sa.String()),
            sa.Column("completion_result", sa.JSON()),
        ],
        "reviews": [
            sa.Column("session_exercise_ids", sa.JSON()),
            sa.Column("session_started_at", sa.String()),
            sa.Column("completion_result", sa.JSON()),
        ],
        "user_vocabulary": [
            sa.Column(
                "success_streak", sa.Integer(), nullable=False, server_default="0"
            )
        ],
        "messages": [
            sa.Column("provider", sa.String(24)),
            sa.Column("generation_mode", sa.String(24)),
            sa.Column("model", sa.String(120)),
        ],
    }
    # Reexecutar uma revisão parcialmente interrompida preserva as colunas já criadas.
    for table, additions in columns.items():
        existing = {
            column["name"] for column in sa.inspect(connection).get_columns(table)
        }
        for column in additions:
            if column.name not in existing:
                op.add_column(table, column)
    existing = {
        column["name"]
        for column in sa.inspect(connection).get_columns("exercise_attempts")
    }
    for column in [
        sa.Column("passage_id", sa.String()),
        sa.Column("review_id", sa.String()),
        sa.Column("idempotency_key", sa.String()),
        sa.Column("feedback", sa.JSON()),
    ]:
        if column.name not in existing:
            if column.name == "review_id" and connection.dialect.name == "sqlite":
                # SQLite aceita FK em coluna nova nullable; evita reconstruir tabelas legadas
                # e perder seus CHECK constraints sem nome.
                connection.exec_driver_sql(
                    "ALTER TABLE exercise_attempts ADD COLUMN review_id VARCHAR REFERENCES reviews(id) ON DELETE SET NULL"
                )
            else:
                op.add_column("exercise_attempts", column)
    foreign_keys = sa.inspect(connection).get_foreign_keys("exercise_attempts")
    if not any("review_id" in key["constrained_columns"] for key in foreign_keys):
        if connection.dialect.name == "sqlite":
            raise RuntimeError(
                "A coluna legada review_id não possui FK; revise uma cópia antes de migrar."
            )
        op.create_foreign_key(
            "fk_attempt_review",
            "exercise_attempts",
            "reviews",
            ["review_id"],
            ["id"],
            ondelete="SET NULL",
        )
    attempt_indexes = {
        index["name"]
        for index in sa.inspect(connection).get_indexes("exercise_attempts")
    }
    if "uq_attempt_user_idempotency" not in attempt_indexes:
        op.create_index(
            "uq_attempt_user_idempotency",
            "exercise_attempts",
            ["user_id", "idempotency_key"],
            unique=True,
        )
    indexes = {index["name"] for index in sa.inspect(connection).get_indexes("reviews")}
    if "uq_pending_review_reference" not in indexes:
        duplicates = connection.execute(
            sa.text(
                "SELECT user_id FROM reviews WHERE status = 'pending' GROUP BY user_id, kind, ref_id HAVING COUNT(*) > 1 LIMIT 1"
            )
        ).first()
        if duplicates:
            raise RuntimeError(
                "Banco legado contém revisões pendentes duplicadas; reconcilie uma cópia antes de migrar."
            )
        op.create_index(
            "uq_pending_review_reference",
            "reviews",
            ["user_id", "kind", "ref_id"],
            unique=True,
            sqlite_where=sa.text("status = 'pending'"),
            postgresql_where=sa.text("status = 'pending'"),
        )


def downgrade():
    raise RuntimeError(
        "Downgrade destrutivo recusado. Restaure uma cópia validada do banco de origem."
    )
