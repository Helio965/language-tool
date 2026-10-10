"""Revisão com lista de atividades congelada e nota calculada no servidor."""

from datetime import datetime, timedelta
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from extensions import db
from models import ExerciseAttempt, Progress, Review, UserVocabulary
from services.common import AppError, learner_bundle, new_id, now_iso, require_user
from content import catalog
from services import aprendizagem, exercicios

INTERVALS = [1, 3, 7, 14, 30]
PASS_SCORE = 60
REASON_PRIORITY = {
    "errors": 0,
    "conversation": 1,
    "low_score": 2,
    "vocabulary_due": 3,
    "spaced": 4,
}


def add_days(timestamp, days):
    return (
        (
            datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            + timedelta(days=days)
        )
        .isoformat()
        .replace("+00:00", "Z")
    )


def due_vocabulary(user_id):
    return list(
        db.session.scalars(
            select(UserVocabulary)
            .where(
                UserVocabulary.user_id == user_id,
                UserVocabulary.status == "learning",
                UserVocabulary.next_review_at <= now_iso(),
            )
            .order_by(UserVocabulary.next_review_at, UserVocabulary.vocabulary_id)
        )
    )


def require_owned(user_id, review_id):
    require_user(user_id)
    db.session.execute(
        update(Review)
        .where(Review.id == review_id, Review.user_id == user_id)
        .values(status=Review.status)
    )
    row = db.session.scalar(
        select(Review)
        .where(Review.id == review_id, Review.user_id == user_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not row:
        raise AppError("NOT_FOUND", "Revisão não encontrada.", 404)
    return row


def item_view(user_id, review):
    lesson = catalog.lesson(review.ref_id) if review.kind == "lesson" else None
    title = (
        lesson["title"]
        if lesson
        else catalog.SKILL_LABELS.get(review.ref_id, review.ref_id)
        if review.kind == "skill"
        else "Vocabulário"
    )
    reasons = {
        "errors": f"Você teve dificuldade com {catalog.SKILL_LABELS.get(review.ref_id, 'este tema')} nos últimos exercícios.",
        "conversation": "Este ponto apareceu nas correções das suas conversas recentes.",
        "spaced": "Revisar alguns dias depois de estudar ajuda a memorizar por mais tempo.",
    }
    if review.reason == "low_score":
        progress = db.session.get(Progress, (user_id, review.ref_id))
        reason = f"Você acertou {progress.score if progress else review.last_score or 0}% nesta aula. Uma revisão rápida ajuda a fixar."
    elif review.reason == "vocabulary_due":
        count = len(due_vocabulary(user_id))
        reason = (
            f"{count} "
            + ("palavra está pronta" if count == 1 else "palavras estão prontas")
            + " para revisão."
        )
    else:
        reason = reasons.get(review.reason, "Revisar ajuda a fixar este conteúdo.")
    return {
        "id": review.id,
        "kind": review.kind,
        "reason": review.reason,
        "title": title,
        "reasonText": reason,
        "dueAt": review.due_at,
        "lessonId": review.ref_id if review.kind == "lesson" else None,
        "estimatedMinutes": 2 if review.kind == "vocabulary" else 4,
    }


def new_review(user_id, kind, ref_id, reason, due_at, interval_step=0):
    return Review(
        id=new_id(),
        user_id=user_id,
        kind=kind,
        ref_id=ref_id,
        reason=reason,
        status="pending",
        due_at=due_at,
        interval_step=interval_step,
        times_reviewed=0,
        time_spent_seconds=0,
        created_at=now_iso(),
    )


def refresh(user_id):
    profile = learner_bundle(user_id)["profile"]
    existing = list(db.session.scalars(select(Review).where(Review.user_id == user_id)))
    planned = []

    def has_pending(kind, ref_id):
        return any(
            review.kind == kind
            and review.ref_id == ref_id
            and review.status == "pending"
            for review in [*existing, *planned]
        )

    timestamp = now_iso()
    for tag in profile.difficulties:
        if not has_pending("skill", tag):
            # A completed spacing sequence is renewed only after new mistakes.
            latest = next(
                iter(
                    sorted(
                        (
                            review
                            for review in existing
                            if review.kind == "skill" and review.ref_id == tag
                        ),
                        key=lambda review: review.created_at,
                        reverse=True,
                    )
                ),
                None,
            )
            new_error = not latest or db.session.scalar(
                select(ExerciseAttempt.id)
                .where(
                    ExerciseAttempt.user_id == user_id,
                    ExerciseAttempt.skill_tag == tag,
                    ExerciseAttempt.context != "placement",
                    ExerciseAttempt.is_correct.is_(False),
                    ExerciseAttempt.created_at
                    > (latest.last_reviewed_at or latest.created_at),
                )
                .limit(1)
            )
            if new_error:
                planned.append(new_review(user_id, "skill", tag, "errors", timestamp))
    for progress in db.session.scalars(
        select(Progress).where(
            Progress.user_id == user_id, Progress.status == "completed"
        )
    ):
        if not progress.completed_at or has_pending("lesson", progress.lesson_id):
            continue
        previous = [
            review
            for review in existing
            if review.kind == "lesson" and review.ref_id == progress.lesson_id
        ]
        if progress.score < 70 and not previous:
            planned.append(
                new_review(
                    user_id, "lesson", progress.lesson_id, "low_score", timestamp
                )
            )
        elif not previous:
            planned.append(
                new_review(
                    user_id,
                    "lesson",
                    progress.lesson_id,
                    "spaced",
                    add_days(progress.completed_at, 1),
                )
            )
        elif progress.score < 70 and all(
            (review.last_reviewed_at or review.created_at) < progress.completed_at
            for review in previous
        ):
            planned.append(
                new_review(
                    user_id, "lesson", progress.lesson_id, "low_score", timestamp
                )
            )
    if due_vocabulary(user_id) and not has_pending("vocabulary", "vocabulary"):
        planned.append(
            new_review(user_id, "vocabulary", "vocabulary", "vocabulary_due", timestamp)
        )
    for review in planned:
        try:
            with db.session.begin_nested():
                db.session.add(review)
                db.session.flush()
        except IntegrityError:
            # Only an established duplicate is recoverable; do not hide other failures.
            duplicate = db.session.scalar(
                select(Review).where(
                    Review.user_id == user_id,
                    Review.kind == review.kind,
                    Review.ref_id == review.ref_id,
                    Review.status == "pending",
                )
            )
            if not duplicate:
                raise
    db.session.commit()
    return list(db.session.scalars(select(Review).where(Review.user_id == user_id)))


def queue(user_id):
    require_user(user_id)
    reviews = refresh(user_id)
    pending = sorted(
        (review for review in reviews if review.status == "pending"),
        key=lambda review: (
            REASON_PRIORITY.get(review.reason, 5),
            review.due_at,
            review.id,
        ),
    )
    timestamp = now_iso()
    return {
        "due": [
            item_view(user_id, review)
            for review in pending
            if review.due_at <= timestamp
        ],
        "upcoming": [
            item_view(user_id, review)
            for review in pending
            if review.due_at > timestamp
        ][:5],
        "completedCount": sum(review.status == "done" for review in reviews),
    }


def session_exercises(user_id, review):
    if review.session_exercise_ids:
        return [
            found["exercise"]
            for identifier in review.session_exercise_ids
            if (found := catalog.exercise(identifier))
        ]
    if review.kind == "vocabulary":
        return [
            catalog.exercise(f"vocab:{item.vocabulary_id}")["exercise"]
            for item in due_vocabulary(user_id)[:6]
        ]
    attempts = list(
        db.session.scalars(
            select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
        )
    )
    missed = {attempt.exercise_id for attempt in attempts if not attempt.is_correct}
    pool = (
        (catalog.lesson(review.ref_id) or {}).get("exercises", [])
        if review.kind == "lesson"
        else [
            exercise
            for lesson in catalog.lessons()
            for exercise in lesson["exercises"]
            if exercise["skillTag"] == review.ref_id
        ]
    )
    pool = [exercise for exercise in pool if exercise["type"] != "write"]
    pool.sort(key=lambda exercise: exercise["id"] not in missed)
    return pool[:5]


def start_session(user_id, review_id):
    review = require_owned(user_id, review_id)
    if review.status == "done":
        raise AppError("REVIEW_COMPLETED", "Esta revisão já foi concluída.", 409)
    exercises = session_exercises(user_id, review)
    if not exercises:
        raise AppError("NOT_FOUND", "Não há atividades para esta revisão agora.", 404)
    if not review.session_exercise_ids:
        review.session_exercise_ids = [exercise["id"] for exercise in exercises]
        review.session_started_at = now_iso()
        db.session.commit()
    attempts = aprendizagem.passage_attempts(user_id, review_id)
    return {
        "review": item_view(user_id, review),
        "exercises": [catalog.to_public_exercise(exercise) for exercise in exercises],
        **aprendizagem.exercise_progress(attempts),
    }


def answer(user_id, review_id, exercise_id, raw_answer, idempotency_key=None):
    review = require_owned(user_id, review_id)
    if review.status == "done":
        raise AppError("REVIEW_COMPLETED", "Esta revisão já foi concluída.", 409)
    if not review.session_exercise_ids:
        raise AppError(
            "REVIEW_NOT_STARTED", "Inicie a revisão antes de responder.", 409
        )
    if exercise_id not in review.session_exercise_ids:
        raise AppError("NOT_FOUND", "Exercício não pertence a esta revisão.", 404)
    feedback, _ = exercicios.answer(
        user_id,
        exercise_id,
        raw_answer,
        "review",
        review_id,
        review_id=review_id,
        idempotency_key=idempotency_key,
    )
    db.session.commit()
    return feedback


def schedule_word(item, correct, timestamp):
    item.times_reviewed += 1
    item.success_streak = (item.success_streak or 0) + 1 if correct else 0
    item.status = "learned" if item.success_streak >= 3 else "learning"
    item.last_reviewed_at = timestamp
    days = INTERVALS[min(item.success_streak, len(INTERVALS) - 1)] if correct else 1
    item.next_review_at = add_days(timestamp, days)


def complete(user_id, review_id, result=None):
    review = require_owned(user_id, review_id)
    if review.completion_result is not None:
        return review.completion_result
    if review.status == "done":
        raise AppError("REVIEW_COMPLETED", "Esta revisão já foi concluída.", 409)
    if not review.session_exercise_ids:
        raise AppError(
            "REVIEW_NOT_STARTED", "Inicie a revisão antes de concluí-la.", 409
        )
    attempts = aprendizagem.passage_attempts(user_id, review_id)
    first = {}
    for attempt in attempts:
        first.setdefault(attempt.exercise_id, attempt.is_correct)
    identifiers = review.session_exercise_ids
    if not identifiers or not set(identifiers).issubset(first):
        raise AppError(
            "REVIEW_INCOMPLETE",
            "Responda a todos os exercícios antes de concluir a revisão.",
            409,
        )
    total = len(identifiers)
    correct = sum(first[identifier] for identifier in identifiers)
    score = int(correct / total * 100 + 0.5)
    seconds = aprendizagem.study_seconds(
        (result or {}).get("timeSpentSeconds", 0), 3600
    )
    timestamp = now_iso()
    review.status = "done"
    review.times_reviewed += 1
    review.last_score = score
    review.time_spent_seconds += seconds
    review.last_reviewed_at = timestamp
    db.session.flush()
    next_review_at = None
    if review.kind == "vocabulary":
        for identifier in identifiers:
            item = db.session.get(
                UserVocabulary, (user_id, identifier[len("vocab:") :])
            )
            if item:
                schedule_word(item, first[identifier], timestamp)
    else:
        next_step = review.interval_step + 1 if score >= PASS_SCORE else 0
        if score < PASS_SCORE or next_step < len(INTERVALS):
            next_review_at = add_days(
                timestamp, INTERVALS[next_step] if score >= PASS_SCORE else 1
            )
            pending = db.session.scalar(
                select(Review).where(
                    Review.user_id == user_id,
                    Review.kind == review.kind,
                    Review.ref_id == review.ref_id,
                    Review.status == "pending",
                )
            )
            if not pending:
                db.session.add(
                    new_review(
                        user_id,
                        review.kind,
                        review.ref_id,
                        "spaced" if score >= PASS_SCORE else review.reason,
                        next_review_at,
                        next_step,
                    )
                )
            else:
                next_review_at = pending.due_at
    message = (
        "Excelente revisão! Esse conteúdo está ficando firme."
        if score >= 80
        else "Boa revisão! Vamos rever mais uma vez daqui a alguns dias."
        if score >= PASS_SCORE
        else "Tudo bem errar na revisão — é assim que se aprende. Vamos rever amanhã."
    )
    output = {
        "reviewId": review_id,
        "correct": correct,
        "total": total,
        "score": score,
        "nextReviewAt": next_review_at,
        "message": message,
    }
    review.completion_result = output
    db.session.commit()
    return output
