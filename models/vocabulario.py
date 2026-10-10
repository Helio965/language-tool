from extensions import db
from .base import PublicModel


class Vocabulary(PublicModel, db.Model):
    __tablename__ = "vocabulary"
    id = db.Column(db.String, primary_key=True)
    word = db.Column(db.String, nullable=False)
    translation = db.Column(db.String, nullable=False)
    meaning = db.Column(db.String, nullable=False)
    part_of_speech = db.Column(db.String, nullable=False)
    level = db.Column(db.String, nullable=False)
    topic = db.Column(db.String, nullable=False)
    examples = db.Column(db.JSON, nullable=False, default=list, server_default="[]")
    phonetic = db.Column(db.String)


class LessonVocabulary(db.Model):
    __tablename__ = "lesson_vocabulary"
    lesson_id = db.Column(
        db.String, db.ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True
    )
    vocabulary_id = db.Column(
        db.String, db.ForeignKey("vocabulary.id", ondelete="CASCADE"), primary_key=True
    )


class UserVocabulary(PublicModel, db.Model):
    __tablename__ = "user_vocabulary"
    __table_args__ = (
        db.CheckConstraint(
            "status IN ('learning', 'learned')", name="ck_vocabulary_status"
        ),
    )
    hidden_fields = frozenset({"success_streak"})
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    vocabulary_id = db.Column(
        db.String, db.ForeignKey("vocabulary.id", ondelete="CASCADE"), primary_key=True
    )
    status = db.Column(db.String, nullable=False)
    times_reviewed = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
    first_seen_at = db.Column(db.String, nullable=False)
    last_reviewed_at = db.Column(db.String)
    next_review_at = db.Column(db.String, nullable=False)
    success_streak = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )
