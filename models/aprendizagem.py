from extensions import db
from .base import PublicModel


class Lesson(PublicModel, db.Model):
    __tablename__ = "lessons"
    id = db.Column(db.String, primary_key=True)
    level = db.Column(db.String, nullable=False)
    sort_order = db.Column(db.Integer, nullable=False)
    title = db.Column(db.String, nullable=False)
    topic = db.Column(db.String, nullable=False)
    content = db.Column(db.JSON, nullable=False)
    estimated_minutes = db.Column(db.Integer, nullable=False)


class Exercise(PublicModel, db.Model):
    __tablename__ = "exercises"
    id = db.Column(db.String, primary_key=True)
    lesson_id = db.Column(
        db.String, db.ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    type = db.Column(db.String, nullable=False)
    prompt = db.Column(db.String, nullable=False)
    options = db.Column(db.JSON, nullable=False, default=list, server_default="[]")
    accepted_answers = db.Column(
        db.JSON, nullable=False, default=list, server_default="[]"
    )
    skill_tag = db.Column(db.String, nullable=False)
