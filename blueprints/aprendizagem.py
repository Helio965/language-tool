"""API educacional compatível com os contratos originais do English AI."""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required
from services.common import AppError, body
from services import aprendizagem, nivelamento, progresso, revisao, vocabulario
from extensions import limiter

bp = Blueprint("aprendizagem", __name__, url_prefix="/api")
ai_limit = limiter.shared_limit("30 per minute", scope="educational-ai")


def user_id():
    return current_user.id


def identifier(value):
    if not isinstance(value, str) or not 1 <= len(value) <= 80:
        raise AppError("VALIDATION", "Identificador inválido.")
    return value


@bp.get("/home")
@login_required
def home():
    return jsonify(progresso.home(user_id()))


@bp.get("/progress")
@login_required
def progress():
    return jsonify(progresso.overview(user_id()))


@bp.post("/placement/start")
@login_required
def placement_start():
    return jsonify(nivelamento.start(user_id()))


@bp.post("/placement/answers")
@login_required
def placement_answers():
    return jsonify(nivelamento.submit(user_id(), body().get("answers")))


@bp.post("/placement/skip")
@login_required
def placement_skip():
    return jsonify(nivelamento.skip(user_id()))


@bp.get("/lessons")
@login_required
def lessons():
    return jsonify(aprendizagem.list_lessons(user_id()))


@bp.get("/lessons/<lesson_id>")
@login_required
def lesson(lesson_id):
    return jsonify(aprendizagem.get_lesson(user_id(), identifier(lesson_id)))


@bp.post("/lessons/<lesson_id>/start")
@login_required
def lesson_start(lesson_id):
    aprendizagem.start_lesson(user_id(), identifier(lesson_id))
    return "", 204


@bp.post("/lessons/<lesson_id>/exercises/<exercise_id>/answer")
@login_required
@ai_limit
def lesson_answer(lesson_id, exercise_id):
    data = body()
    return jsonify(
        aprendizagem.check_answer(
            user_id(),
            identifier(lesson_id),
            identifier(exercise_id),
            data.get("answer"),
            request.headers.get("Idempotency-Key"),
        )
    )


@bp.post("/lessons/<lesson_id>/complete")
@login_required
def lesson_complete(lesson_id):
    return jsonify(
        aprendizagem.complete_lesson(
            user_id(), identifier(lesson_id), body().get("timeSpentSeconds", 0)
        )
    )


@bp.post("/lessons/<lesson_id>/explain")
@login_required
@ai_limit
def lesson_explain(lesson_id):
    return jsonify(
        aprendizagem.explain_again(
            user_id(), identifier(lesson_id), body().get("attempt", 0)
        )
    )


@bp.post("/lessons/<lesson_id>/example")
@login_required
@ai_limit
def lesson_example(lesson_id):
    return jsonify(
        aprendizagem.another_example(
            user_id(), identifier(lesson_id), body().get("attempt", 0)
        )
    )


@bp.get("/vocabulary")
@login_required
def vocabulary():
    return jsonify(vocabulario.list_vocabulary(user_id()))


@bp.get("/vocabulary/<word_id>")
@login_required
def vocabulary_word(word_id):
    return jsonify(vocabulario.get(user_id(), identifier(word_id)))


@bp.put("/vocabulary/<word_id>/status")
@login_required
def vocabulary_status(word_id):
    return jsonify(
        vocabulario.set_status(user_id(), identifier(word_id), body().get("status"))
    )


@bp.get("/reviews")
@login_required
def reviews():
    return jsonify(revisao.queue(user_id()))


@bp.post("/reviews/<review_id>/session")
@login_required
def review_session(review_id):
    return jsonify(revisao.start_session(user_id(), identifier(review_id)))


@bp.post("/reviews/<review_id>/answers")
@login_required
@ai_limit
def review_answer(review_id):
    data = body()
    return jsonify(
        revisao.answer(
            user_id(),
            identifier(review_id),
            identifier(data.get("exerciseId")),
            data.get("answer"),
            request.headers.get("Idempotency-Key"),
        )
    )


@bp.post("/reviews/<review_id>/complete")
@login_required
def review_complete(review_id):
    return jsonify(revisao.complete(user_id(), identifier(review_id), body()))
