from flask_login import UserMixin
from extensions import db
from .base import PublicModel


class User(UserMixin, PublicModel, db.Model):
    __tablename__ = "users"
    __table_args__ = (
        db.CheckConstraint("role IN ('user', 'admin')", name="ck_user_role"),
    )
    hidden_fields = frozenset({"password_hash", "session_version"})
    id = db.Column(db.String, primary_key=True)
    name = db.Column(db.String, nullable=False)
    email = db.Column(db.String, unique=True, nullable=False)
    password_hash = db.Column(db.String, nullable=False)
    role = db.Column(db.String, nullable=False, default="user", server_default="user")
    created_at = db.Column(db.String, nullable=False)
    terms_accepted_at = db.Column(db.String, nullable=False)
    session_version = db.Column(
        db.Integer, nullable=False, default=0, server_default="0"
    )

    def get_id(self):
        return f"{self.id}:{self.session_version}"


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        db.Index("idx_password_reset_user_created", "user_id", "created_at"),
        db.Index("idx_password_reset_expires", "expires_at"),
    )
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash = db.Column(db.String, nullable=False, unique=True)
    expires_at = db.Column(db.String, nullable=False)
    used_at = db.Column(db.String)
    created_at = db.Column(db.String, nullable=False)


class LearningProfile(PublicModel, db.Model):
    __tablename__ = "learning_profiles"
    __table_args__ = (
        db.CheckConstraint(
            "estimated_level IN ('beginner', 'basic', 'intermediate', 'advanced')",
            name="ck_profile_level",
        ),
    )
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goal = db.Column(db.String)
    perceived_level = db.Column(
        db.String, nullable=False, default="unknown", server_default="unknown"
    )
    prior_experience = db.Column(db.String)
    conversation_interest = db.Column(
        db.Boolean, nullable=False, default=False, server_default="0"
    )
    professional_interest = db.Column(
        db.Boolean, nullable=False, default=False, server_default="0"
    )
    interest_areas = db.Column(
        db.JSON, nullable=False, default=list, server_default="[]"
    )
    estimated_level = db.Column(db.String)
    placement_score = db.Column(db.Integer)
    placement_completed_at = db.Column(db.String)
    onboarding_completed_at = db.Column(db.String)
    difficulties = db.Column(db.JSON, nullable=False, default=list, server_default="[]")
    updated_at = db.Column(db.String, nullable=False)


class Preferences(PublicModel, db.Model):
    __tablename__ = "preferences"
    __table_args__ = (
        db.CheckConstraint(
            "explanation_language IN ('auto', 'pt', 'en')",
            name="ck_preferences_language",
        ),
        db.CheckConstraint(
            "correction_intensity IN ('light', 'balanced', 'detailed')",
            name="ck_preferences_correction",
        ),
        db.CheckConstraint(
            "reply_length IN ('short', 'balanced')", name="ck_preferences_length"
        ),
    )
    user_id = db.Column(
        db.String, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    explanation_language = db.Column(
        db.String, nullable=False, default="auto", server_default="auto"
    )
    correction_intensity = db.Column(
        db.String, nullable=False, default="balanced", server_default="balanced"
    )
    reply_length = db.Column(
        db.String, nullable=False, default="balanced", server_default="balanced"
    )
    show_translations = db.Column(
        db.Boolean, nullable=False, default=True, server_default="1"
    )
    save_conversation_history = db.Column(
        db.Boolean, nullable=False, default=True, server_default="1"
    )
    study_reminders = db.Column(
        db.Boolean, nullable=False, default=False, server_default="0"
    )
    daily_goal_minutes = db.Column(
        db.Integer, nullable=False, default=10, server_default="10"
    )
    updated_at = db.Column(db.String, nullable=False)
