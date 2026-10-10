from sqlalchemy import text
from extensions import db
from .base import PublicModel


class Progress(PublicModel, db.Model):
    __tablename__ = "progress"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('in_progress', 'completed')", name="ck_progress_status"
        ),
    )
    hidden_fields = frozenset({"passage_id", "completion_result"})
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    lesson_id = db.Column(
        db.String, db.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True
    )
    status = db.Column(db.String, nullable=False)
    correct_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    total_count = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    score = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    time_spent_seconds = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    started_at = db.Column(db.String, nullable=False)
    completed_at = db.Column(db.String)
    updated_at = db.Column(db.String, nullable=False)
    passage_id = db.Column(db.String)
    completion_result = db.Column(db.JSON)


class Review(PublicModel, db.Model):
    __tablename__ = "reviews"
    __table_args__ = (
        db.CheckConstraint(
            "kind IN ('lesson', 'skill', 'vocabulary')", name="ck_review_kind"
        ),
        db.CheckConstraint("status IN ('pending', 'done')", name="ck_review_status"),
        db.Index("idx_reviews_user_status_due", "user_id", "status", "due_at"),
        db.Index(
            "uq_pending_review_reference",
            "user_id",
            "kind",
            "ref_id",
            unique=True,
            sqlite_where=text("status = 'pending'"),
            postgresql_where=text("status = 'pending'"),
        ),
    )
    hidden_fields = frozenset(
        {"session_exercise_ids", "session_started_at", "completion_result"}
    )
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    kind = db.Column(db.String, nullable=False)
    ref_id = db.Column(db.String, nullable=False)
    reason = db.Column(db.String, nullable=False)
    status = db.Column(db.String, nullable=False)
    due_at = db.Column(db.String, nullable=False)
    interval_step = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    times_reviewed = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    last_score = db.Column(db.Integer)
    time_spent_seconds = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    last_reviewed_at = db.Column(db.String)
    created_at = db.Column(db.String, nullable=False)
    session_exercise_ids = db.Column(db.JSON)
    session_started_at = db.Column(db.String)
    completion_result = db.Column(db.JSON)
