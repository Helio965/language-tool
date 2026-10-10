"""Original relational schema; adopt a fully validated legacy database."""

from alembic import op
import sqlalchemy as sa
from models.migration import validate_legacy_connection

revision = "0001_legacy_schema"
down_revision = None
branch_labels = None
depends_on = None

BASE_COLUMNS = {
    "lessons": [
        "id",
        "level",
        "sort_order",
        "title",
        "topic",
        "content",
        "estimated_minutes",
    ],
    "users": [
        "id",
        "name",
        "email",
        "password_hash",
        "role",
        "created_at",
        "terms_accepted_at",
        "session_version",
    ],
    "vocabulary": [
        "id",
        "word",
        "translation",
        "meaning",
        "part_of_speech",
        "level",
        "topic",
        "examples",
        "phonetic",
    ],
    "conversations": [
        "id",
        "user_id",
        "topic_id",
        "title",
        "level_at_start",
        "context",
        "retention",
        "expires_at",
        "user_message_count",
        "corrected_skills",
        "content_deleted_at",
        "created_at",
        "updated_at",
        "ended_at",
    ],
    "exercises": [
        "id",
        "lesson_id",
        "type",
        "prompt",
        "options",
        "accepted_answers",
        "skill_tag",
    ],
    "learning_profiles": [
        "user_id",
        "goal",
        "perceived_level",
        "prior_experience",
        "conversation_interest",
        "professional_interest",
        "interest_areas",
        "estimated_level",
        "placement_score",
        "placement_completed_at",
        "onboarding_completed_at",
        "difficulties",
        "updated_at",
    ],
    "lesson_vocabulary": ["lesson_id", "vocabulary_id"],
    "password_reset_tokens": [
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "used_at",
        "created_at",
    ],
    "preferences": [
        "user_id",
        "explanation_language",
        "correction_intensity",
        "reply_length",
        "show_translations",
        "save_conversation_history",
        "study_reminders",
        "daily_goal_minutes",
        "updated_at",
    ],
    "progress": [
        "user_id",
        "lesson_id",
        "status",
        "correct_count",
        "total_count",
        "score",
        "time_spent_seconds",
        "started_at",
        "completed_at",
        "updated_at",
    ],
    "reviews": [
        "id",
        "user_id",
        "kind",
        "ref_id",
        "reason",
        "status",
        "due_at",
        "interval_step",
        "times_reviewed",
        "last_score",
        "time_spent_seconds",
        "last_reviewed_at",
        "created_at",
    ],
    "user_vocabulary": [
        "user_id",
        "vocabulary_id",
        "status",
        "times_reviewed",
        "first_seen_at",
        "last_reviewed_at",
        "next_review_at",
    ],
    "exercise_attempts": [
        "id",
        "user_id",
        "exercise_id",
        "lesson_id",
        "skill_tag",
        "context",
        "answer",
        "is_correct",
        "created_at",
    ],
    "messages": [
        "id",
        "conversation_id",
        "role",
        "content",
        "translation",
        "corrections",
        "deferred_corrections",
        "notices",
        "created_at",
    ],
}


def upgrade():
    connection = op.get_bind()
    existing = set(sa.inspect(connection).get_table_names())
    if existing.intersection(BASE_COLUMNS):
        validate_legacy_connection(connection, BASE_COLUMNS)
        columns = {c["name"] for c in sa.inspect(connection).get_columns("users")}
        if "session_version" not in columns:
            op.add_column(
                "users",
                sa.Column(
                    "session_version", sa.Integer(), nullable=False, server_default="0"
                ),
            )
    else:
        op.create_table(
            "lessons",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column("level", sa.String(), nullable=False),
            sa.Column("sort_order", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("topic", sa.String(), nullable=False),
            sa.Column("content", sa.JSON(), nullable=False),
            sa.Column("estimated_minutes", sa.Integer(), nullable=False),
        )
        op.create_table(
            "users",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("password_hash", sa.String(), nullable=False),
            sa.Column("role", sa.String(), nullable=False, server_default="user"),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("terms_accepted_at", sa.String(), nullable=False),
            sa.Column(
                "session_version", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.UniqueConstraint("email", name=None),
            sa.CheckConstraint("role IN ('user', 'admin')", name="ck_user_role"),
        )
        op.create_table(
            "vocabulary",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column("word", sa.String(), nullable=False),
            sa.Column("translation", sa.String(), nullable=False),
            sa.Column("meaning", sa.String(), nullable=False),
            sa.Column("part_of_speech", sa.String(), nullable=False),
            sa.Column("level", sa.String(), nullable=False),
            sa.Column("topic", sa.String(), nullable=False),
            sa.Column("examples", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("phonetic", sa.String(), nullable=True),
        )
        op.create_table(
            "conversations",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("topic_id", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("level_at_start", sa.String(), nullable=False),
            sa.Column("context", sa.JSON(), nullable=False),
            sa.Column("retention", sa.String(), nullable=False),
            sa.Column("expires_at", sa.String(), nullable=True),
            sa.Column(
                "user_message_count", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column(
                "corrected_skills", sa.JSON(), nullable=False, server_default="[]"
            ),
            sa.Column("content_deleted_at", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.Column("ended_at", sa.String(), nullable=True),
            sa.CheckConstraint(
                "retention IN ('saved', 'ephemeral')", name="ck_conversation_retention"
            ),
        )
        op.create_table(
            "exercises",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column(
                "lesson_id",
                sa.String(),
                sa.ForeignKey("lessons.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("type", sa.String(), nullable=False),
            sa.Column("prompt", sa.String(), nullable=False),
            sa.Column("options", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column(
                "accepted_answers", sa.JSON(), nullable=False, server_default="[]"
            ),
            sa.Column("skill_tag", sa.String(), nullable=False),
        )
        op.create_table(
            "learning_profiles",
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column("goal", sa.String(), nullable=True),
            sa.Column(
                "perceived_level", sa.String(), nullable=False, server_default="unknown"
            ),
            sa.Column("prior_experience", sa.String(), nullable=True),
            sa.Column(
                "conversation_interest",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            ),
            sa.Column(
                "professional_interest",
                sa.Boolean(),
                nullable=False,
                server_default="0",
            ),
            sa.Column("interest_areas", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("estimated_level", sa.String(), nullable=True),
            sa.Column("placement_score", sa.Integer(), nullable=True),
            sa.Column("placement_completed_at", sa.String(), nullable=True),
            sa.Column("onboarding_completed_at", sa.String(), nullable=True),
            sa.Column("difficulties", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.CheckConstraint(
                "estimated_level IN ('beginner', 'basic', 'intermediate', 'advanced')",
                name="ck_profile_level",
            ),
        )
        op.create_table(
            "lesson_vocabulary",
            sa.Column(
                "lesson_id",
                sa.String(),
                sa.ForeignKey("lessons.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column(
                "vocabulary_id",
                sa.String(),
                sa.ForeignKey("vocabulary.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
        )
        op.create_table(
            "password_reset_tokens",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("token_hash", sa.String(), nullable=False),
            sa.Column("expires_at", sa.String(), nullable=False),
            sa.Column("used_at", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.UniqueConstraint("token_hash", name=None),
        )
        op.create_table(
            "preferences",
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column(
                "explanation_language",
                sa.String(),
                nullable=False,
                server_default="auto",
            ),
            sa.Column(
                "correction_intensity",
                sa.String(),
                nullable=False,
                server_default="balanced",
            ),
            sa.Column(
                "reply_length", sa.String(), nullable=False, server_default="balanced"
            ),
            sa.Column(
                "show_translations", sa.Boolean(), nullable=False, server_default="1"
            ),
            sa.Column(
                "save_conversation_history",
                sa.Boolean(),
                nullable=False,
                server_default="1",
            ),
            sa.Column(
                "study_reminders", sa.Boolean(), nullable=False, server_default="0"
            ),
            sa.Column(
                "daily_goal_minutes", sa.Integer(), nullable=False, server_default="10"
            ),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.CheckConstraint(
                "correction_intensity IN ('light', 'balanced', 'detailed')",
                name="ck_preferences_correction",
            ),
            sa.CheckConstraint(
                "explanation_language IN ('auto', 'pt', 'en')",
                name="ck_preferences_language",
            ),
            sa.CheckConstraint(
                "reply_length IN ('short', 'balanced')", name="ck_preferences_length"
            ),
        )
        op.create_table(
            "progress",
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column(
                "lesson_id",
                sa.String(),
                sa.ForeignKey("lessons.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column(
                "correct_count", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("total_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "time_spent_seconds", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("started_at", sa.String(), nullable=False),
            sa.Column("completed_at", sa.String(), nullable=True),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.CheckConstraint(
                "status IN ('in_progress', 'completed')", name="ck_progress_status"
            ),
        )
        op.create_table(
            "reviews",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("ref_id", sa.String(), nullable=False),
            sa.Column("reason", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("due_at", sa.String(), nullable=False),
            sa.Column(
                "interval_step", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column(
                "times_reviewed", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("last_score", sa.Integer(), nullable=True),
            sa.Column(
                "time_spent_seconds", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("last_reviewed_at", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.CheckConstraint(
                "kind IN ('lesson', 'skill', 'vocabulary')", name="ck_review_kind"
            ),
            sa.CheckConstraint(
                "status IN ('pending', 'done')", name="ck_review_status"
            ),
        )
        op.create_table(
            "user_vocabulary",
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column(
                "vocabulary_id",
                sa.String(),
                sa.ForeignKey("vocabulary.id", ondelete="CASCADE"),
                primary_key=True,
                nullable=False,
            ),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column(
                "times_reviewed", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("first_seen_at", sa.String(), nullable=False),
            sa.Column("last_reviewed_at", sa.String(), nullable=True),
            sa.Column("next_review_at", sa.String(), nullable=False),
            sa.CheckConstraint(
                "status IN ('learning', 'learned')", name="ck_vocabulary_status"
            ),
        )
        op.create_table(
            "exercise_attempts",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column(
                "user_id",
                sa.String(),
                sa.ForeignKey("users.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("exercise_id", sa.String(), nullable=False),
            sa.Column(
                "lesson_id",
                sa.String(),
                sa.ForeignKey("lessons.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("skill_tag", sa.String(), nullable=False),
            sa.Column("context", sa.String(), nullable=False),
            sa.Column("answer", sa.String(), nullable=False),
            sa.Column("is_correct", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.CheckConstraint(
                "context IN ('lesson', 'placement', 'review')",
                name="ck_attempt_context",
            ),
        )
        op.create_table(
            "messages",
            sa.Column("id", sa.String(), primary_key=True, nullable=False),
            sa.Column(
                "conversation_id",
                sa.String(),
                sa.ForeignKey("conversations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("role", sa.String(), nullable=False),
            sa.Column("content", sa.String(), nullable=False),
            sa.Column("translation", sa.String(), nullable=True),
            sa.Column("corrections", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column(
                "deferred_corrections", sa.JSON(), nullable=False, server_default="[]"
            ),
            sa.Column("notices", sa.JSON(), nullable=False, server_default="[]"),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.CheckConstraint("role IN ('user', 'assistant')", name="ck_message_role"),
        )
    # Missing indexes are safe to add to adopted databases as well.
    if "idx_conversations_expiry" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("conversations")
    }:
        op.create_index(
            "idx_conversations_expiry",
            "conversations",
            ["expires_at"],
            unique=False,
            sqlite_where=sa.text("content_deleted_at IS NULL"),
            postgresql_where=sa.text("content_deleted_at IS NULL"),
        )
    if "idx_conversations_user_updated" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("conversations")
    }:
        op.create_index(
            "idx_conversations_user_updated",
            "conversations",
            ["user_id", "updated_at"],
            unique=False,
        )
    if "idx_password_reset_expires" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("password_reset_tokens")
    }:
        op.create_index(
            "idx_password_reset_expires",
            "password_reset_tokens",
            ["expires_at"],
            unique=False,
        )
    if "idx_password_reset_user_created" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("password_reset_tokens")
    }:
        op.create_index(
            "idx_password_reset_user_created",
            "password_reset_tokens",
            ["user_id", "created_at"],
            unique=False,
        )
    if "idx_reviews_user_status_due" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("reviews")
    }:
        op.create_index(
            "idx_reviews_user_status_due",
            "reviews",
            ["user_id", "status", "due_at"],
            unique=False,
        )
    if "idx_attempts_user_created" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("exercise_attempts")
    }:
        op.create_index(
            "idx_attempts_user_created",
            "exercise_attempts",
            ["user_id", "created_at"],
            unique=False,
        )
    if "idx_messages_conversation_created" not in {
        i["name"] for i in sa.inspect(connection).get_indexes("messages")
    }:
        op.create_index(
            "idx_messages_conversation_created",
            "messages",
            ["conversation_id", "created_at"],
            unique=False,
        )


def downgrade():
    raise RuntimeError(
        "Downgrade destrutivo recusado. Restaure uma cópia validada do banco de origem."
    )
