"""Vocabulário estudado e autodeclaração explícita do estado de aprendizagem."""

from datetime import datetime, timedelta
from sqlalchemy import select
from extensions import db
from models import UserVocabulary
from services.common import AppError, learner_bundle, now_iso, require_user
from content import catalog


def word_view(entry, item):
    lesson = next(
        (
            lesson
            for lesson in catalog.lessons()
            if entry["id"] in lesson["vocabularyIds"]
        ),
        None,
    )
    return {
        **entry,
        "status": item.status if item else None,
        "timesReviewed": item.times_reviewed if item else 0,
        "nextReviewAt": item.next_review_at if item else None,
        "due": bool(
            item and item.status == "learning" and item.next_review_at <= now_iso()
        ),
        "lessonId": lesson["id"] if lesson else None,
        "lessonTitle": lesson["title"] if lesson else None,
    }


def require_entry(identifier):
    entry = catalog.vocabulary_entry(identifier)
    if not entry:
        raise AppError("NOT_FOUND", "Palavra não encontrada.", 404)
    return entry


def list_vocabulary(user_id):
    level = learner_bundle(user_id)["profile"].estimated_level or "beginner"
    items = list(
        db.session.scalars(
            select(UserVocabulary).where(UserVocabulary.user_id == user_id)
        )
    )
    by_id = {item.vocabulary_id: item for item in items}
    studied = [
        word_view(entry, item)
        for item in items
        if (entry := catalog.vocabulary_entry(item.vocabulary_id))
    ]
    studied.sort(key=lambda item: (not item["due"], item["word"].casefold()))
    suggestions = [
        word_view(entry, None)
        for entry in catalog.vocabulary()
        if entry["level"] == level and entry["id"] not in by_id
    ][:6]
    return {
        "studied": studied,
        "suggestions": suggestions,
        "counts": {
            "studied": len(studied),
            "learning": sum(item["status"] == "learning" for item in studied),
            "learned": sum(item["status"] == "learned" for item in studied),
            "due": sum(item["due"] for item in studied),
        },
    }


def get(user_id, identifier):
    require_user(user_id)
    return word_view(
        require_entry(identifier), db.session.get(UserVocabulary, (user_id, identifier))
    )


def set_status(user_id, identifier, status):
    require_user(user_id)
    entry = require_entry(identifier)
    if status not in {"learning", "learned"}:
        raise AppError("VALIDATION", "Status inválido.")
    timestamp = now_iso()
    item = db.session.get(UserVocabulary, (user_id, identifier))
    if item:
        if item.status == status:
            return word_view(entry, item)
        item.status = status
        if status == "learning":
            item.next_review_at = timestamp
            item.success_streak = 0
    else:
        item = UserVocabulary(
            user_id=user_id,
            vocabulary_id=identifier,
            status=status,
            times_reviewed=0,
            success_streak=0,
            first_seen_at=timestamp,
            next_review_at=(
                datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                + timedelta(days=1)
            )
            .isoformat()
            .replace("+00:00", "Z"),
        )
        db.session.add(item)
    db.session.commit()
    return word_view(entry, item)
