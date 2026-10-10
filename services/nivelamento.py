"""Nivelamento adaptativo por etapas: estimativa pedagógica, sem certificação."""

from flask import session
from extensions import db
from sqlalchemy import select, update
from models import ExerciseAttempt, LearningProfile
from services.common import AppError, learner_bundle, new_id, now_iso
from content import catalog
from services.exercicios import normalize_answer


def evaluate_placement(answers):
    stages = []
    for index, stage in enumerate(catalog.PLACEMENT_STAGES):
        questions = [
            question
            for question in catalog.placement_questions()
            if question["stage"] == stage
        ]
        if any(question["id"] not in answers for question in questions):
            return {
                "status": "continue",
                "stageNumber": index + 1,
                "totalStages": len(catalog.PLACEMENT_STAGES),
                "questions": [
                    catalog.to_public_placement_question(question)
                    for question in questions
                ],
            }
        correct = sum(
            normalize_answer(answers[question["id"]])
            == normalize_answer(question["answer"])
            for question in questions
        )
        passed = correct >= catalog.PLACEMENT_PASS_THRESHOLD
        stages.append(
            {
                "stage": stage,
                "correct": correct,
                "total": len(questions),
                "passed": passed,
            }
        )
        if not passed:
            break
    passed = sum(stage["passed"] for stage in stages)
    correct = sum(stage["correct"] for stage in stages)
    answered = sum(stage["total"] for stage in stages)
    return {
        "status": "done",
        "evaluation": {
            "level": catalog.LEVELS[min(passed, len(catalog.LEVELS) - 1)],
            "score": int(correct / answered * 100 + 0.5) if answered else 0,
            "correct": correct,
            "answered": answered,
            "stages": stages,
        },
    }


def result_view(profile, evaluation, skipped=False):
    level = evaluation["level"]
    perceived = profile.perceived_level
    comparison = (
        "Agora você tem um ponto de partida. Ele será ajustado conforme você estuda."
    )
    if skipped:
        comparison = "Você pode refazer o nivelamento quando quiser, no seu perfil."
    elif perceived in catalog.LEVELS:
        diff = catalog.LEVELS.index(level) - catalog.LEVELS.index(perceived)
        comparison = (
            "Sua percepção combinou com a estimativa. Ótimo autoconhecimento!"
            if diff == 0
            else "Você sabe mais do que imaginava! Vamos aproveitar isso."
            if diff > 0
            else "Vamos começar um pouco antes para consolidar a base — você avança rápido quando estiver confortável."
        )
    return {
        **evaluation,
        "levelLabel": catalog.LEVEL_LABELS[level],
        "levelDescription": catalog.LEVEL_DESCRIPTIONS[level],
        "perceivedLevel": perceived,
        "comparison": comparison,
        "skipped": skipped,
        "notice": "Este resultado é uma estimativa pedagógica e não uma certificação oficial de proficiência.",
    }


def start(user_id):
    learner_bundle(user_id)
    state = session.get("placement")
    if not state or state.get("userId") != user_id or state.get("result"):
        state = {"userId": user_id, "passageId": new_id(), "answers": {}}
        session["placement"] = state
    return evaluate_placement(state["answers"])


def submit(user_id, answers):
    bundle = learner_bundle(user_id)
    state = session.get("placement")
    if not state or state.get("userId") != user_id:
        raise AppError(
            "PLACEMENT_NOT_STARTED",
            "Inicie o nivelamento antes de enviar as respostas.",
            409,
        )
    if not isinstance(answers, dict) or len(answers) > 12:
        raise AppError("VALIDATION", "Respostas de nivelamento inválidas.")
    known = {question["id"]: question for question in catalog.placement_questions()}
    for identifier, value in answers.items():
        if (
            identifier not in known
            or not isinstance(value, str)
            or not value.strip()
            or len(value) > 200
        ):
            raise AppError("VALIDATION", "Resposta de nivelamento inválida.")
        if normalize_answer(value) not in {
            normalize_answer(option) for option in known[identifier]["options"]
        }:
            raise AppError("VALIDATION", "Escolha uma das alternativas apresentadas.")
        if identifier in state["answers"] and normalize_answer(
            value
        ) != normalize_answer(state["answers"][identifier]):
            raise AppError(
                "CONFLICT",
                "As respostas de uma etapa concluída não podem ser alteradas. Reinicie o nivelamento para refazer.",
                409,
            )
    if state.get("result"):
        return {"status": "done", "result": state["result"]}
    step = evaluate_placement(state["answers"])
    allowed = {question["id"] for question in step["questions"]}
    if any(
        identifier not in allowed and identifier not in state["answers"]
        for identifier in answers
    ):
        raise AppError("VALIDATION", "Responda apenas à etapa apresentada.")
    combined = {
        **state["answers"],
        **{
            identifier: value.strip()
            for identifier, value in answers.items()
            if identifier in allowed
        },
    }
    if not allowed.issubset(combined):
        session["placement"] = {**state, "answers": combined}
        return evaluate_placement(combined)
    next_step = evaluate_placement(combined)
    if next_step["status"] == "continue":
        session["placement"] = {**state, "answers": combined}
        return next_step
    evaluation = next_step["evaluation"]
    db.session.execute(
        update(LearningProfile)
        .where(LearningProfile.user_id == user_id)
        .values(updated_at=LearningProfile.updated_at)
    )
    persisted = list(
        db.session.scalars(
            select(ExerciseAttempt).where(
                ExerciseAttempt.user_id == user_id,
                ExerciseAttempt.passage_id == state["passageId"],
            )
        )
    )
    recorded = {attempt.exercise_id: attempt for attempt in persisted}
    timestamp = persisted[0].created_at if persisted else now_iso()
    evaluated_stages = {stage["stage"] for stage in evaluation["stages"]}
    for identifier, answer in combined.items():
        question = known[identifier]
        if question["stage"] not in evaluated_stages:
            continue
        exercise_id = f"placement:{identifier}"
        if exercise_id in recorded:
            if normalize_answer(recorded[exercise_id].answer) != normalize_answer(
                answer
            ):
                raise AppError(
                    "CONFLICT", "Esta etapa já foi concluída com outras respostas.", 409
                )
            continue
        db.session.add(
            ExerciseAttempt(
                id=new_id(),
                user_id=user_id,
                exercise_id=exercise_id,
                lesson_id=None,
                skill_tag=question["skillTag"],
                context="placement",
                answer=answer,
                is_correct=normalize_answer(answer)
                == normalize_answer(question["answer"]),
                created_at=timestamp,
                passage_id=state["passageId"],
                idempotency_key=f"{state['passageId']}:{identifier}",
            )
        )
    profile = bundle["profile"]
    profile.estimated_level = evaluation["level"]
    profile.placement_score = evaluation["score"]
    profile.placement_completed_at, profile.updated_at = timestamp, timestamp
    result = result_view(profile, evaluation)
    db.session.commit()
    session["placement"] = {**state, "answers": combined, "result": result}
    return {"status": "done", "result": result}


def skip(user_id):
    profile = learner_bundle(user_id)["profile"]
    timestamp = now_iso()
    profile.estimated_level = "beginner"
    profile.placement_score = None
    profile.placement_completed_at, profile.updated_at = timestamp, timestamp
    result = result_view(
        profile,
        {"level": "beginner", "score": 0, "correct": 0, "answered": 0, "stages": []},
        True,
    )
    db.session.commit()
    session.pop("placement", None)
    return result
