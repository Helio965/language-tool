"""Indicadores de atividade calculados de registros reais, no fuso do aluno."""

from collections import Counter, defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from flask import current_app
from sqlalchemy import select
from extensions import db
from models import (
    Conversation,
    ExerciseAttempt,
    LearningProfile,
    Progress,
    Review,
    UserVocabulary,
)
from services.common import learner_bundle, now, require_user
from content import catalog
from services import aprendizagem, revisao, vocabulario


def local_date(timestamp, time_zone):
    value = (
        timestamp
        if isinstance(timestamp, datetime)
        else datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    )
    return value.astimezone(ZoneInfo(time_zone)).date().isoformat()


def shift_date(day, days):
    return (datetime.fromisoformat(day) + timedelta(days=days)).date().isoformat()


def compute_streak(active, today):
    cursor = today if today in active else shift_date(today, -1)
    streak = 0
    while cursor in active:
        streak += 1
        cursor = shift_date(cursor, -1)
    return streak


def conversation_seconds(conversation):
    if not conversation.user_message_count:
        return 0
    started = datetime.fromisoformat(conversation.created_at.replace("Z", "+00:00"))
    last = datetime.fromisoformat(conversation.updated_at.replace("Z", "+00:00"))
    return max(0, min(int((last - started).total_seconds()), 3 * 3600))


def snapshot(user_id):
    bundle = learner_bundle(user_id)
    profile = bundle["profile"]
    progress = list(
        db.session.scalars(select(Progress).where(Progress.user_id == user_id))
    )
    attempts = list(
        db.session.scalars(
            select(ExerciseAttempt)
            .where(ExerciseAttempt.user_id == user_id)
            .order_by(ExerciseAttempt.created_at, ExerciseAttempt.id)
        )
    )
    vocabulary = list(
        db.session.scalars(
            select(UserVocabulary).where(UserVocabulary.user_id == user_id)
        )
    )
    reviews = list(db.session.scalars(select(Review).where(Review.user_id == user_id)))
    conversations = list(
        db.session.scalars(select(Conversation).where(Conversation.user_id == user_id))
    )
    zone = current_app.config.get("TIME_ZONE", "America/Sao_Paulo")
    today = local_date(now(), zone)
    minutes_by_day = defaultdict(float)
    active = set()

    def activity(timestamp, seconds):
        day = local_date(timestamp, zone)
        active.add(day)
        minutes_by_day[day] += seconds / 60

    for record in progress:
        activity(record.completed_at or record.updated_at, record.time_spent_seconds)
    for review in reviews:
        if review.last_reviewed_at:
            activity(review.last_reviewed_at, review.time_spent_seconds)
    for conversation in conversations:
        if conversation.user_message_count:
            activity(conversation.created_at, conversation_seconds(conversation))
    practice = [attempt for attempt in attempts if attempt.context != "placement"]
    for attempt in practice:
        active.add(local_date(attempt.created_at, zone))
    study_seconds = (
        sum(record.time_spent_seconds for record in progress)
        + sum(review.time_spent_seconds for review in reviews)
        + sum(conversation_seconds(conversation) for conversation in conversations)
    )
    completed_ids = {
        record.lesson_id for record in progress if record.status == "completed"
    }
    weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
    week = []
    for offset in range(-6, 1):
        day = shift_date(today, offset)
        week.append(
            {
                "date": day,
                "weekday": weekdays[datetime.fromisoformat(day).weekday()],
                "minutes": int(minutes_by_day[day] + 0.5),
                "active": day in active,
            }
        )
    skill_stats = {}
    for attempt in practice:
        total, correct = skill_stats.get(attempt.skill_tag, (0, 0))
        skill_stats[attempt.skill_tag] = (total + 1, correct + attempt.is_correct)
    skills = [
        {
            "skillTag": tag,
            "label": catalog.SKILL_LABELS.get(tag, tag),
            "attempts": total,
            "accuracy": int(correct / total * 100 + 0.5),
        }
        for tag, (total, correct) in sorted(
            skill_stats.items(), key=lambda item: -item[1][0]
        )
    ][:6]
    errors = Counter(
        attempt.skill_tag for attempt in practice[-40:] if not attempt.is_correct
    )
    for conversation in conversations:
        errors.update(conversation.corrected_skills or [])
    recurring = [
        {
            "skillTag": tag,
            "label": catalog.SKILL_LABELS.get(tag, tag),
            "count": count,
            "lessonId": catalog.SKILL_LESSON.get(tag),
        }
        for tag, count in errors.most_common(4)
        if count >= 2
    ]
    level = None
    if profile.estimated_level:
        in_level = [
            lesson
            for lesson in catalog.lessons()
            if lesson["level"] == profile.estimated_level
        ]
        count = sum(lesson["id"] in completed_ids for lesson in in_level)
        index = catalog.LEVELS.index(profile.estimated_level)
        next_level = (
            catalog.LEVELS[index + 1] if index + 1 < len(catalog.LEVELS) else None
        )
        level = {
            "level": profile.estimated_level,
            "label": catalog.LEVEL_LABELS[profile.estimated_level],
            "nextLevel": next_level,
            "nextLabel": catalog.LEVEL_LABELS[next_level] if next_level else None,
            "completedInLevel": count,
            "totalInLevel": len(in_level),
            "percent": int(count / len(in_level) * 100 + 0.5) if in_level else 100,
        }
    totals = {
        "lessonsCompleted": len(completed_ids),
        "exercisesDone": len(practice),
        "accuracy": int(
            sum(attempt.is_correct for attempt in practice) / len(practice) * 100 + 0.5
        )
        if practice
        else None,
        "wordsStudied": len(vocabulary),
        "wordsLearned": sum(item.status == "learned" for item in vocabulary),
        "reviewsCompleted": sum(review.status == "done" for review in reviews),
        "conversations": sum(
            conversation.user_message_count > 0 for conversation in conversations
        ),
        "studyDays": len(active),
        "streakDays": compute_streak(active, today),
        "studyMinutes": int(study_seconds / 60 + 0.5),
    }
    return (
        {
            "hasActivity": bool(
                totals["exercisesDone"]
                or totals["conversations"]
                or totals["lessonsCompleted"]
            ),
            "level": level,
            "totals": totals,
            "week": week,
            "todayMinutes": int(minutes_by_day[today] + 0.5),
            "skills": skills,
            "recurringErrors": recurring,
        },
        progress,
        bundle,
    )


def overview(user_id):
    require_user(user_id)
    queue = revisao.queue(user_id)
    data, progress, _ = snapshot(user_id)
    recent = sorted(
        (
            record
            for record in progress
            if record.status == "completed" and record.completed_at
        ),
        key=lambda record: record.completed_at,
        reverse=True,
    )[:5]
    return {
        **data,
        "needsReview": queue["due"][:5],
        "recentLessons": [
            {
                "lessonId": record.lesson_id,
                "title": (catalog.lesson(record.lesson_id) or {}).get(
                    "title", record.lesson_id
                ),
                "score": record.score,
                "completedAt": record.completed_at,
            }
            for record in recent
        ],
    }


def home(user_id):
    queue = revisao.queue(user_id)
    data, _, bundle = snapshot(user_id)
    lessons = aprendizagem.list_lessons(user_id)
    words = vocabulario.list_vocabulary(user_id)
    from services.conversacao import list_conversations

    conversations = list_conversations(user_id)
    profile = bundle["profile"]
    recent_words = sorted(
        words["studied"], key=lambda item: item["nextReviewAt"] or "", reverse=True
    )[:4]
    return {
        "firstName": bundle["user"].name.strip().split()[0],
        "level": profile.estimated_level,
        "levelLabel": catalog.LEVEL_LABELS[profile.estimated_level]
        if profile.estimated_level
        else None,
        "goal": profile.goal,
        "goalLabel": catalog.GOAL_LABELS.get(profile.goal),
        "continueLesson": next(
            (lesson for lesson in lessons if lesson["recommended"]), None
        ),
        "reviewCount": len(queue["due"]),
        "reviewDue": queue["due"][:3],
        "recentWords": recent_words,
        "streakDays": data["totals"]["streakDays"],
        "todayMinutes": data["todayMinutes"],
        "dailyGoalMinutes": bundle["preferences"].daily_goal_minutes,
        "lessonsCompleted": data["totals"]["lessonsCompleted"],
        "accuracy": data["totals"]["accuracy"],
        "lastConversation": next(iter(conversations), None),
        "hasActivity": data["hasActivity"],
    }
