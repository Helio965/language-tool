"""Perfil e preferências UC03/UC12, com validações iguais às regras originais."""

from datetime import timedelta
from sqlalchemy import delete, update
from sqlalchemy.orm import Session
from extensions import db
from models import LearningProfile, Preferences, Conversation, Message, User
from services.common import AppError, now, iso, now_iso, require_user

GOALS = {"basics", "conversation", "work", "travel", "technology"}
LEVELS = {"beginner", "basic", "intermediate", "advanced"}
EXPERIENCES = {"none", "school", "course", "self_taught"}
INTERESTS = {
    "technology",
    "business",
    "travel",
    "food",
    "entertainment",
    "sports",
    "education",
    "everyday",
}


def defaults(user_id):
    timestamp = now_iso()
    return (
        LearningProfile(
            user_id=user_id,
            perceived_level="unknown",
            conversation_interest=False,
            professional_interest=False,
            interest_areas=[],
            difficulties=[],
            updated_at=timestamp,
        ),
        Preferences(
            user_id=user_id,
            explanation_language="auto",
            correction_intensity="balanced",
            reply_length="balanced",
            show_translations=True,
            save_conversation_history=True,
            study_reminders=False,
            daily_goal_minutes=10,
            updated_at=timestamp,
        ),
    )


def ensure_account_defaults(user_id):
    """Repair missing legacy child rows in their own atomic transaction."""
    # Inspection must not flush unrelated caller changes before the repair lock.
    with db.session.no_autoflush:
        missing = (
            db.session.get(LearningProfile, user_id) is None
            or db.session.get(Preferences, user_id) is None
        )
    if not missing:
        return
    with Session(db.engine) as repair_session, repair_session.begin():
        # SQLite serializes writers; PostgreSQL locks the user's row. Concurrent
        # repairs recheck children after that lock instead of duplicating them.
        owner = repair_session.execute(
            update(User)
            .where(User.id == user_id)
            .values(session_version=User.session_version)
        )
        if owner.rowcount != 1:
            raise AppError("UNAUTHENTICATED", "Entre na sua conta para continuar.", 401)
        profile, preferences = defaults(user_id)
        if repair_session.get(LearningProfile, user_id) is None:
            repair_session.add(profile)
        if repair_session.get(Preferences, user_id) is None:
            repair_session.add(preferences)


def load_profile(user_id):
    require_user(user_id)
    ensure_account_defaults(user_id)
    return db.session.get(LearningProfile, user_id)


def load_preferences(user_id):
    require_user(user_id)
    ensure_account_defaults(user_id)
    return db.session.get(Preferences, user_id)


def save_profile(user_id, data):
    errors = {}
    if not isinstance(data.get("goal"), str) or data.get("goal") not in GOALS:
        errors["goal"] = "Escolha um objetivo."
    if not isinstance(data.get("perceivedLevel"), str) or data.get(
        "perceivedLevel"
    ) not in LEVELS | {"unknown"}:
        errors["perceivedLevel"] = "Escolha uma opção."
    if (
        not isinstance(data.get("priorExperience"), str)
        or data.get("priorExperience") not in EXPERIENCES
    ):
        errors["priorExperience"] = "Escolha uma opção."
    interests = data.get("interestAreas")
    if not isinstance(interests, list) or any(
        not isinstance(v, str) or v not in INTERESTS for v in interests
    ):
        errors["interestAreas"] = "Escolha áreas válidas."
    elif len(interests) > 3:
        errors["interestAreas"] = "Escolha até 3 áreas."
    for key in ("conversationInterest", "professionalInterest"):
        if not isinstance(data.get(key), bool):
            errors[key] = "Valor inválido."
    if errors:
        raise AppError("VALIDATION", "Perfil inválido.", fields=errors)
    profile = load_profile(user_id)
    profile.goal = data["goal"]
    profile.perceived_level = data["perceivedLevel"]
    profile.prior_experience = data["priorExperience"]
    profile.conversation_interest = data["conversationInterest"]
    profile.professional_interest = data["professionalInterest"]
    profile.interest_areas = list(dict.fromkeys(interests))
    profile.updated_at = now_iso()
    profile.onboarding_completed_at = (
        profile.onboarding_completed_at or profile.updated_at
    )
    db.session.commit()
    return profile.to_dict()


def update_preferences(user_id, data):
    enums = {
        "explanationLanguage": ("explanation_language", {"auto", "pt", "en"}),
        "correctionIntensity": (
            "correction_intensity",
            {"light", "balanced", "detailed"},
        ),
        "replyLength": ("reply_length", {"short", "balanced"}),
    }
    booleans = {
        "showTranslations": "show_translations",
        "saveConversationHistory": "save_conversation_history",
        "studyReminders": "study_reminders",
    }
    updates, errors = {}, {}
    for key, (attribute, allowed) in enums.items():
        if key in data:
            if not isinstance(data[key], str) or data[key] not in allowed:
                errors[key] = "Opção inválida."
            else:
                updates[attribute] = data[key]
    for key, attribute in booleans.items():
        if key in data:
            if not isinstance(data[key], bool):
                errors[key] = "Valor inválido."
            else:
                updates[attribute] = data[key]
    if "dailyGoalMinutes" in data:
        goal = data["dailyGoalMinutes"]
        if type(goal) is not int or goal not in {5, 10, 15, 20, 30}:
            errors["dailyGoalMinutes"] = "Escolha uma meta válida."
        else:
            updates["daily_goal_minutes"] = goal
    if errors:
        raise AppError("VALIDATION", "Preferências inválidas.", fields=errors)
    preferences = load_preferences(user_id)
    # Conversas encerradas perdem conteúdo; a conversa ativa passa à retenção temporária.
    if updates.get("save_conversation_history") is False:
        timestamp = now_iso()
        conversations = db.session.scalars(
            db.select(Conversation).where(Conversation.user_id == user_id)
        ).all()
        for conversation in conversations:
            conversation.retention = "ephemeral"
            expiry = iso(now() + timedelta(days=1))
            conversation.expires_at = (
                min(conversation.expires_at, expiry)
                if conversation.expires_at
                else expiry
            )
            if conversation.ended_at:
                db.session.execute(
                    delete(Message).where(Message.conversation_id == conversation.id)
                )
                conversation.context = {"facts": [], "summary": "", "recentSkills": []}
                conversation.content_deleted_at = timestamp
    for attribute, value in updates.items():
        setattr(preferences, attribute, value)
    preferences.updated_at = now_iso()
    db.session.commit()
    return preferences.to_dict()
