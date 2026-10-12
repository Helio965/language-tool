"""UC09 HTTP contracts; business decisions remain in the conversation service."""

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from extensions import limiter
from services import conversacao
from services.common import body

bp = Blueprint("conversacao", __name__, url_prefix="/api")


@bp.get("/conversation-topics")
@login_required
def topics():
    return jsonify(conversacao.list_topics(current_user.id))


@bp.get("/conversations")
@login_required
def history():
    return jsonify(conversacao.list_conversations(current_user.id))


@bp.post("/conversations")
@login_required
@limiter.limit("20 per minute")
def start():
    return jsonify(conversacao.start(current_user.id, body().get("topicId"))), 201


@bp.delete("/conversations")
@login_required
def remove_all():
    return jsonify(deleted=conversacao.remove_all(current_user.id))


@bp.get("/conversations/<conversation_id>")
@login_required
def get(conversation_id):
    return jsonify(conversacao.get(current_user.id, conversation_id))


@bp.post("/conversations/<conversation_id>/messages")
@login_required
@limiter.limit("30 per minute")
def send(conversation_id):
    return jsonify(
        conversacao.send(
            current_user.id,
            conversation_id,
            body().get("text"),
            request.headers.get("Idempotency-Key"),
        )
    ), 201


@bp.post("/conversations/<conversation_id>/end")
@login_required
def end(conversation_id):
    return jsonify(conversacao.end(current_user.id, conversation_id))


@bp.delete("/conversations/<conversation_id>")
@login_required
def remove(conversation_id):
    conversacao.remove(current_user.id, conversation_id)
    return "", 204
