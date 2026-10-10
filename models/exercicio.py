from extensions import db
from .base import PublicModel


class ExerciseAttempt(PublicModel, db.Model):
    __tablename__ = "exercise_attempts"
    __table_args__ = (
        db.CheckConstraint(
            "context IN ('lesson', 'placement', 'review')", name="ck_attempt_context"
        ),
        db.Index("idx_attempts_user_created", "user_id", "created_at"),
        db.Index(
            "uq_attempt_user_idempotency", "user_id", "idempotency_key", unique=True
        ),
    )
    hidden_fields = frozenset(
        {"passage_id", "review_id", "idempotency_key", "feedback"}
    )
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    exercise_id = db.Column(db.String, nullable=False)
    lesson_id = db.Column(db.String, db.ForeignKey("lessons.id", ondelete="SET NULL"))
    skill_tag = db.Column(db.String, nullable=False)
    context = db.Column(db.String, nullable=False)
    answer = db.Column(db.String, nullable=False)
    is_correct = db.Column(db.Boolean, nullable=False)
    created_at = db.Column(db.String, nullable=False)
    passage_id = db.Column(db.String)
    review_id = db.Column(db.String, db.ForeignKey("reviews.id", ondelete="SET NULL"))
    idempotency_key = db.Column(db.String)
    feedback = db.Column(db.JSON)
