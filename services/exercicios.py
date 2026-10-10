"""Correção determinística e registro atômico de tentativas (RF10/RF11)."""

from datetime import datetime, timedelta
import hashlib
import re
import unicodedata
from sqlalchemy import select
from extensions import db
from models import ExerciseAttempt, LearningProfile
from services.common import AppError, iso, learner_bundle, new_id, now_iso
from content import catalog

_CONTRACTIONS = {
    "i'm": "i am",
    "you're": "you are",
    "we're": "we are",
    "they're": "they are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "that's": "that is",
    "what's": "what is",
    "where's": "where is",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "can't": "cannot",
    "won't": "will not",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "haven't": "have not",
    "hasn't": "has not",
    "i'll": "i will",
    "you'll": "you will",
    "we'll": "we will",
    "they'll": "they will",
    "he'll": "he will",
    "she'll": "she will",
    "i'd": "i would",
    "let's": "let us",
}


def normalize_answer(value):
    text = (
        unicodedata.normalize("NFKC", value)
        .lower()
        .translate(
            str.maketrans({"‘": "'", "’": "'", "´": "'", "`": "'", "“": '"', "”": '"'})
        )
    )
    text = re.sub(r"[.!?;,:\"]+", " ", text)
    return re.sub(
        r"\bcan not\b",
        "cannot",
        " ".join(_CONTRACTIONS.get(word, word) for word in text.split()),
    )


def edit_distance(left, right):
    previous = list(range(len(right) + 1))
    for i, lchar in enumerate(left, 1):
        current = [i]
        for j, rchar in enumerate(right, 1):
            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (lchar != rchar),
                )
            )
        previous = current
    return previous[-1]


def grade_closed_exercise(exercise, answer):
    expected = next(iter(exercise["acceptedAnswers"]), None)
    normalized = normalize_answer(answer)
    accepted = [normalize_answer(item) for item in exercise["acceptedAnswers"]]
    status = "incorrect"
    if normalized and normalized in accepted:
        status = "correct"
    elif (
        exercise["type"] in {"fill_blank", "translate"}
        and len(normalized) >= 3
        and accepted
    ):
        tolerance = max(1, len(normalized) // 12)
        if (
            min(edit_distance(normalized, candidate) for candidate in accepted)
            <= tolerance
        ):
            status = "almost"
    return {"status": status, "expected": expected}


def check_write_requirements(exercise, answer):
    text = answer.replace("‘", "'").replace("’", "'")
    minimum = exercise.get("minWords", 3)
    if len(text.split()) < minimum:
        return {
            "ok": False,
            "message": f"Escreva uma frase completa, com pelo menos {minimum} palavras.",
        }
    for requirement in exercise.get("requirements", []):
        if not re.search(requirement["pattern"], text, re.I):
            return {"ok": False, "message": requirement["message"]}
    return {"ok": True, "message": None}


def feedback_title(status, seed):
    if status == "almost":
        return "Quase lá!"
    if status == "incorrect":
        return "Vamos ajustar"
    return ["Muito bem!", "Isso mesmo!", "Perfeito!", "Excelente!"][seed % 4]


def grade_exercise(bundle, exercise, answer, attempt_number=0):
    learner, preferences = bundle["learner"], bundle["preferences"]
    language = learner["explanationLanguage"]
    intensity = preferences.correction_intensity
    level = learner["level"]
    explanation = exercise["explanation"][language]
    support = (
        exercise["explanation"]["en" if language == "pt" else "pt"]
        if level != "advanced"
        else None
    )
    include_tip = level == "beginner" or intensity == "detailed"
    tip = exercise["explanation"].get("tip", {}).get(language) if include_tip else None
    feedback = {
        "exerciseId": exercise["id"],
        "userAnswer": answer,
        "expectedAnswer": None,
        "explanation": explanation,
        "supportExplanation": support,
        "tip": tip,
        "correction": None,
        "aiFeedback": None,
    }
    if exercise["type"] == "write":
        requirements = check_write_requirements(exercise, answer)
        if not requirements["ok"]:
            feedback.update(
                status="incorrect",
                title="Quase lá!",
                explanation=requirements["message"],
                supportExplanation=explanation,
            )
            return feedback
        from ai.provider import get_ai_service
        from ai.correction import build_correction, select_learning_corrections

        evaluation = get_ai_service().correct(
            {"learner": learner, "exercise": exercise, "answer": answer}
        )
        issues = evaluation["issues"]
        # Display preferences never weaken the assessment: meaning/grammar always count.
        status = (
            "incorrect"
            if any(issue["severity"] != "naturalness" for issue in issues)
            else "correct"
        )
        shown = select_learning_corrections(issues, intensity)
        correction = build_correction(answer, shown, language, include_tip)
        feedback.update(
            status=status,
            title=feedback_title(status, attempt_number),
            correction=correction,
            aiFeedback=evaluation.get("feedback"),
        )
        if correction:
            feedback.update(
                expectedAnswer=correction["suggestion"],
                explanation=correction["explanation"],
                tip=correction.get("tip") or tip,
            )
        if evaluation.get("ai"):
            feedback["ai"] = evaluation["ai"]
        return feedback
    result = grade_closed_exercise(exercise, answer)
    feedback.update(
        status=result["status"],
        title=feedback_title(result["status"], attempt_number),
        expectedAnswer=result["expected"],
    )
    if result["status"] == "almost":
        feedback["explanation"] = (
            ("Confira a grafia: " if language == "pt" else "Check the spelling: ")
            + f'"{result["expected"]}". '
            + explanation
        )
    return feedback


def compute_difficulties(attempts, window=20):
    recent = sorted(
        (item for item in attempts if item.context != "placement"),
        key=lambda item: (item.created_at, item.id),
        reverse=True,
    )[:window]
    stats = {}
    for item in recent:
        total, errors = stats.get(item.skill_tag, (0, 0))
        stats[item.skill_tag] = (total + 1, errors + (not item.is_correct))
    return [
        tag
        for tag, (total, errors) in sorted(stats.items(), key=lambda item: -item[1][1])
        if errors >= 2 and errors / total > 0.3
    ]


def answer(
    user_id,
    exercise_id,
    raw_answer,
    context,
    passage_id,
    review_id=None,
    idempotency_key=None,
):
    """Stage a response and difficulty changes; caller owns the transaction commit."""
    bundle = learner_bundle(user_id)
    found = catalog.exercise(exercise_id)
    if not found:
        raise AppError("NOT_FOUND", "Exercício não encontrado.", 404)
    if not isinstance(raw_answer, str) or not raw_answer.strip():
        raise AppError(
            "VALIDATION",
            "Resposta vazia.",
            fields={"answer": "Escreva ou escolha uma resposta."},
        )
    answer_text = raw_answer.strip()
    if len(answer_text) > 1000:
        raise AppError(
            "VALIDATION",
            "Resposta muito longa.",
            fields={"answer": "Use no máximo 1000 caracteres."},
        )
    privacy_message = None
    if found["exercise"]["type"] == "write":
        from ai.conversation import privacy_notice, redact_sensitive_data

        redacted = redact_sensitive_data(answer_text)
        answer_text = redacted["text"]
        privacy_message = privacy_notice(redacted["redactedKinds"])
    if idempotency_key is not None and (
        not isinstance(idempotency_key, str) or not 1 <= len(idempotency_key) <= 100
    ):
        raise AppError("VALIDATION", "Identificador de envio inválido.")
    key = (
        idempotency_key
        or hashlib.sha256(
            f"{context}:{passage_id}:{exercise_id}:{answer_text}".encode()
        ).hexdigest()
    )
    existing = db.session.scalar(
        select(ExerciseAttempt).where(
            ExerciseAttempt.user_id == user_id, ExerciseAttempt.idempotency_key == key
        )
    )
    if existing:
        if (
            existing.exercise_id != exercise_id
            or existing.answer != answer_text
            or existing.passage_id != passage_id
        ):
            raise AppError(
                "CONFLICT", "Este identificador já foi usado em outra resposta.", 409
            )
        return existing.feedback, False
    all_attempts = list(
        db.session.scalars(
            select(ExerciseAttempt).where(ExerciseAttempt.user_id == user_id)
        )
    )
    feedback = grade_exercise(bundle, found["exercise"], answer_text, len(all_attempts))
    if privacy_message:
        feedback["notices"] = [privacy_message]
    timestamp = now_iso()
    previous = max((attempt.created_at for attempt in all_attempts), default="")
    if timestamp <= previous:
        timestamp = iso(
            datetime.fromisoformat(previous.replace("Z", "+00:00"))
            + timedelta(milliseconds=1)
        )
    attempt = ExerciseAttempt(
        id=new_id(),
        user_id=user_id,
        exercise_id=exercise_id,
        lesson_id=found["exercise"].get("lessonId"),
        skill_tag=found["exercise"]["skillTag"],
        context=context,
        answer=answer_text,
        is_correct=feedback["status"] == "correct",
        created_at=timestamp,
        passage_id=passage_id,
        review_id=review_id,
        idempotency_key=key,
        feedback=feedback,
    )
    db.session.add(attempt)
    profile = bundle["profile"]
    profile.difficulties = compute_difficulties([*all_attempts, attempt])
    profile.updated_at = now_iso()
    db.session.flush()
    return feedback, True
