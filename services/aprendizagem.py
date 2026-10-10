"""Aulas, passagens de estudo e conclusão derivada das tentativas persistidas."""

from sqlalchemy import select, update
from extensions import db
from models import ExerciseAttempt, LearningProfile, Progress, UserVocabulary
from services.common import AppError, learner_bundle, new_id, now_iso, require_user
from content import catalog
from services import exercicios
from datetime import datetime, timedelta


def require_lesson(lesson_id):
    lesson = catalog.lesson(lesson_id)
    if not lesson:
        raise AppError("NOT_FOUND", "Aula não encontrada.", 404)
    return lesson


def recommend_lesson(lessons, progress, level):
    in_progress = next(
        (
            lesson
            for lesson in lessons
            if any(
                row.lesson_id == lesson["id"] and row.status == "in_progress"
                for row in progress
            )
        ),
        None,
    )
    if in_progress:
        return in_progress
    not_completed = [
        lesson
        for lesson in lessons
        if not any(
            row.lesson_id == lesson["id"] and row.status == "completed"
            for row in progress
        )
    ]
    return (
        next((lesson for lesson in not_completed if lesson["level"] == level), None)
        or next(
            (
                lesson
                for lesson in not_completed
                if catalog.LEVELS.index(lesson["level"]) > catalog.LEVELS.index(level)
            ),
            None,
        )
        or next(iter(not_completed), None)
    )


def summarize(lesson, progress, level, recommended_id=None):
    record = next((row for row in progress if row.lesson_id == lesson["id"]), None)
    return {
        "id": lesson["id"],
        "title": lesson["title"],
        "topic": lesson["topic"],
        "level": lesson["level"],
        "order": lesson["order"],
        "summary": lesson["summary"],
        "estimatedMinutes": lesson["estimatedMinutes"],
        "exerciseCount": len(lesson["exercises"]),
        "status": "completed"
        if record and record.status == "completed"
        else "in_progress"
        if record
        else "available",
        "score": record.score if record and record.status == "completed" else None,
        "recommended": lesson["id"] == recommended_id,
        "aboveLevel": catalog.LEVELS.index(lesson["level"])
        > catalog.LEVELS.index(level),
    }


def list_lessons(user_id):
    bundle = learner_bundle(user_id)
    level = bundle["profile"].estimated_level or "beginner"
    progress = list(
        db.session.scalars(select(Progress).where(Progress.user_id == user_id))
    )
    lessons = catalog.lessons()
    recommended = recommend_lesson(lessons, progress, level)
    return [
        summarize(lesson, progress, level, recommended["id"] if recommended else None)
        for lesson in lessons
    ]


def passage_attempts(user_id, passage_id):
    if not passage_id:
        return []
    return list(
        db.session.scalars(
            select(ExerciseAttempt)
            .where(
                ExerciseAttempt.user_id == user_id,
                ExerciseAttempt.passage_id == passage_id,
            )
            .order_by(ExerciseAttempt.created_at, ExerciseAttempt.id)
        )
    )


def exercise_progress(attempts):
    latest = {attempt.exercise_id: attempt.feedback for attempt in attempts}
    return {
        "answeredExerciseIds": list(latest),
        "exerciseProgress": [
            {"exerciseId": key, "feedback": value} for key, value in latest.items()
        ],
    }


def get_lesson(user_id, lesson_id):
    lesson = require_lesson(lesson_id)
    bundle = learner_bundle(user_id)
    level = bundle["profile"].estimated_level or "beginner"
    language = bundle["learner"]["explanationLanguage"]
    progress = list(
        db.session.scalars(select(Progress).where(Progress.user_id == user_id))
    )
    recommended = recommend_lesson(catalog.lessons(), progress, level)
    current = next((row for row in progress if row.lesson_id == lesson_id), None)
    return {
        **summarize(
            lesson, progress, level, recommended["id"] if recommended else None
        ),
        "objectives": lesson["objectives"],
        "language": language,
        "supportLanguageAvailable": level != "advanced",
        "explanation": [
            {
                "primary": paragraph[language],
                "support": paragraph["en" if language == "pt" else "pt"],
            }
            for paragraph in lesson["explanation"]
        ],
        "table": lesson.get("table"),
        "examples": lesson["examples"],
        "vocabulary": [
            catalog.vocabulary_entry(identifier)
            for identifier in lesson["vocabularyIds"]
        ],
        "exercises": [
            catalog.to_public_exercise(exercise) for exercise in lesson["exercises"]
        ],
        "practiceTopicId": f"lesson:{lesson_id}",
        "takeaways": lesson["takeaways"],
        **exercise_progress(
            passage_attempts(user_id, current.passage_id if current else None)
        ),
    }


def locked_progress(user_id, lesson_id):
    # SQLite ignores FOR UPDATE. This no-op acquires its write lock before the
    # read; PostgreSQL takes a row lock. Parallel retries then see committed data.
    db.session.execute(
        update(Progress)
        .where(Progress.user_id == user_id, Progress.lesson_id == lesson_id)
        .values(passage_id=Progress.passage_id)
    )
    return db.session.scalar(
        select(Progress)
        .where(Progress.user_id == user_id, Progress.lesson_id == lesson_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def start_lesson(user_id, lesson_id):
    require_lesson(lesson_id)
    bundle = learner_bundle(user_id)
    if not bundle["profile"].placement_completed_at:
        raise AppError(
            "PLACEMENT_REQUIRED",
            "Faça o nivelamento ou escolha começar do zero antes da aula.",
            409,
        )
    row = locked_progress(user_id, lesson_id)
    timestamp = now_iso()
    if row and row.passage_id and row.completion_result is None:
        return
    if row is None:
        row = Progress(
            user_id=user_id,
            lesson_id=lesson_id,
            status="in_progress",
            correct_count=0,
            total_count=0,
            score=0,
            time_spent_seconds=0,
            started_at=timestamp,
            updated_at=timestamp,
        )
        db.session.add(row)
    row.passage_id = new_id()
    row.completion_result = None
    row.started_at = timestamp
    row.updated_at = timestamp
    db.session.commit()


def check_answer(user_id, lesson_id, exercise_id, raw_answer, idempotency_key=None):
    lesson = require_lesson(lesson_id)
    if exercise_id not in {exercise["id"] for exercise in lesson["exercises"]}:
        raise AppError("NOT_FOUND", "Exercício não encontrado.", 404)
    row = locked_progress(user_id, lesson_id)
    if not row or not row.passage_id:
        raise AppError(
            "LESSON_NOT_STARTED",
            "Inicie a aula antes de responder aos exercícios.",
            409,
        )
    if row.completion_result is not None:
        raise AppError(
            "LESSON_COMPLETED",
            "Inicie uma nova passagem pela aula para praticar novamente.",
            409,
        )
    feedback, _ = exercicios.answer(
        user_id,
        exercise_id,
        raw_answer,
        "lesson",
        row.passage_id,
        idempotency_key=idempotency_key,
    )
    db.session.commit()
    return feedback


def study_seconds(value, maximum=3 * 3600):
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or value < 0
        or value > maximum
    ):
        raise AppError("VALIDATION", "Tempo de estudo inválido.")
    return int(value + 0.5)


def should_level_up(level, lessons, progress):
    index = catalog.LEVELS.index(level)
    if index == len(catalog.LEVELS) - 1:
        return None
    required = [lesson for lesson in lessons if lesson["level"] == level]
    completed = {
        record.lesson_id: record.score
        for record in progress
        if record.status == "completed"
    }
    if (
        required
        and all(lesson["id"] in completed for lesson in required)
        and sum(completed[lesson["id"]] for lesson in required) / len(required) >= 70
    ):
        return catalog.LEVELS[index + 1]
    return None


def complete_lesson(user_id, lesson_id, time_spent_seconds=0):
    lesson = require_lesson(lesson_id)
    bundle = learner_bundle(user_id)
    row = locked_progress(user_id, lesson_id)
    if not row or not row.passage_id:
        raise AppError("LESSON_NOT_STARTED", "Inicie a aula antes de concluí-la.", 409)
    if row.completion_result is not None:
        return row.completion_result
    attempts = passage_attempts(user_id, row.passage_id)
    first = {}
    for attempt in attempts:
        first.setdefault(attempt.exercise_id, attempt.is_correct)
    identifiers = {exercise["id"] for exercise in lesson["exercises"]}
    if not identifiers or not identifiers.issubset(first):
        raise AppError(
            "LESSON_INCOMPLETE",
            "Responda a todos os exercícios antes de concluir a aula.",
            409,
        )
    correct = sum(first[identifier] for identifier in identifiers)
    total = len(identifiers)
    score = int(correct / total * 100 + 0.5)
    seconds = study_seconds(time_spent_seconds)
    timestamp = now_iso()
    row.status = "completed"
    row.correct_count, row.total_count, row.score = correct, total, score
    row.time_spent_seconds += seconds
    row.completed_at, row.updated_at = timestamp, timestamp
    new_words = []
    for identifier in lesson["vocabularyIds"]:
        if not db.session.get(UserVocabulary, (user_id, identifier)):
            word = catalog.vocabulary_entry(identifier)
            if word:
                db.session.add(
                    UserVocabulary(
                        user_id=user_id,
                        vocabulary_id=identifier,
                        status="learning",
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
                )
                new_words.append(word)
    profile = bundle["profile"]
    level = profile.estimated_level or "beginner"
    progress = list(
        db.session.scalars(select(Progress).where(Progress.user_id == user_id))
    )
    promoted = should_level_up(level, catalog.lessons(), progress)
    if promoted:
        profile.estimated_level = promoted
        profile.updated_at = timestamp
    effective = promoted or level
    next_lesson = recommend_lesson(catalog.lessons(), progress, effective)
    result = {
        "lessonId": lesson_id,
        "correct": correct,
        "total": total,
        "score": score,
        "timeSpentSeconds": seconds,
        "newWords": new_words,
        "levelUp": {"level": promoted, "label": catalog.LEVEL_LABELS[promoted]}
        if promoted
        else None,
        "nextLesson": summarize(next_lesson, progress, effective, next_lesson["id"])
        if next_lesson
        else None,
        "takeaways": lesson["takeaways"],
        "practiceTopicId": f"lesson:{lesson_id}",
        "reviewSuggested": score < 70,
    }
    row.completion_result = result
    db.session.commit()
    return result


def explain_again(user_id, lesson_id, attempt=0):
    if (
        isinstance(attempt, bool)
        or not isinstance(attempt, int)
        or not 0 <= attempt <= 1000
    ):
        raise AppError("VALIDATION", "Número de explicações inválido.")
    from ai.provider import get_ai_service

    bundle = learner_bundle(user_id)
    text = get_ai_service().explain(
        {
            "learner": bundle["learner"],
            "lesson": require_lesson(lesson_id),
            "style": "another_way",
            "attempt": attempt,
        }
    )
    return {"text": text, "language": bundle["learner"]["explanationLanguage"]}


def another_example(user_id, lesson_id, attempt=0):
    if (
        isinstance(attempt, bool)
        or not isinstance(attempt, int)
        or not 0 <= attempt <= 1000
    ):
        raise AppError("VALIDATION", "Número de exemplos inválido.")
    from ai.provider import get_ai_service

    return get_ai_service().another_example(
        {
            "learner": learner_bundle(user_id)["learner"],
            "lesson": require_lesson(lesson_id),
            "attempt": attempt,
        }
    )
