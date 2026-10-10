"""Conversation ownership, privacy, atomic turns and pedagogical feedback."""

from datetime import datetime, timedelta
import hashlib
import hmac
import re

from flask import current_app
from sqlalchemy import delete, literal_column, or_, select, update
from sqlalchemy.exc import SQLAlchemyError

from ai.conversation import (
    empty_context,
    privacy_notice,
    redact_sensitive_data,
    sanitize_context,
)
from ai.correction import build_correction, decide_conversation_corrections
from ai.personality import policy_for
from ai.provider import get_ai_service
from content import catalog
from extensions import db
from models import Conversation, Message, Preferences, Review
from services.common import (
    AppError,
    iso,
    learner_bundle,
    new_id,
    now,
    now_iso,
    require_user,
)

GOAL_AREAS = {
    "basics": ["everyday"],
    "conversation": ["everyday", "entertainment"],
    "work": ["business"],
    "travel": ["travel", "food"],
    "technology": ["technology"],
}
LEVELS = ("beginner", "basic", "intermediate", "advanced")
DEMO_NOTICE = "Modo demonstração: resposta roteirizada, sem geração por IA externa."


def _messages(conversation_id):
    # The Node SQLite store used insertion order for equal millisecond timestamps.
    # UUID sorting would reverse retained user/assistant pairs after migration.
    tie_order = (
        literal_column("messages.rowid")
        if db.engine.dialect.name == "sqlite"
        else Message.id
    )
    return list(
        db.session.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at, tie_order)
        )
    )


def _delete_content(conversation, timestamp=None):
    timestamp = timestamp or now_iso()
    db.session.execute(
        delete(Message).where(Message.conversation_id == conversation.id)
    )
    conversation.context = empty_context()
    conversation.content_deleted_at = timestamp
    conversation.ended_at = conversation.ended_at or timestamp


def _owned(user_id, conversation_id, require_content=False):
    require_user(user_id)
    conversation = db.session.get(Conversation, conversation_id)
    if conversation is None or conversation.user_id != user_id:
        raise AppError("NOT_FOUND", "Conversa não encontrada.", 404)
    if (
        not conversation.content_deleted_at
        and conversation.expires_at
        and conversation.expires_at <= now_iso()
    ):
        _delete_content(conversation)
        db.session.commit()
    if require_content and conversation.content_deleted_at:
        raise AppError(
            "CONVERSATION_ENDED",
            "O conteúdo desta conversa foi excluído ou expirou. Inicie uma nova conversa.",
            409,
        )
    return conversation


def _summary(conversation, messages=None):
    messages = messages if messages is not None else _messages(conversation.id)
    last = messages[-1].content if messages else ""
    return {
        "id": conversation.id,
        "topicId": conversation.topic_id,
        "title": conversation.title,
        "createdAt": conversation.created_at,
        "updatedAt": conversation.updated_at,
        "endedAt": conversation.ended_at,
        "messageCount": conversation.user_message_count,
        "preview": last if len(last) <= 80 else last[:77] + "…",
        "retention": conversation.retention,
    }


def _new_message(
    conversation_id,
    role,
    text,
    timestamp,
    translation=None,
    corrections=None,
    deferred=None,
    notices=None,
    metadata=None,
):
    metadata = metadata or {}
    if metadata.get("mode") == "demo":
        notices = list(notices or []) + [DEMO_NOTICE]
    return Message(
        id=new_id(),
        conversation_id=conversation_id,
        role=role,
        content=text,
        translation=translation,
        corrections=corrections or [],
        deferred_corrections=deferred or [],
        notices=notices or [],
        created_at=timestamp,
        provider=metadata.get("provider"),
        generation_mode=metadata.get("mode"),
        model=metadata.get("model"),
    )


def list_topics(user_id):
    bundle = learner_bundle(user_id)
    profile = bundle["profile"]
    level = profile.estimated_level or "beginner"
    interests, goals = (
        set(profile.interest_areas or []),
        set(GOAL_AREAS.get(profile.goal, [])),
    )
    topics = catalog.topics()

    def score(topic):
        return sum(2 * (area in interests) + (area in goals) for area in topic["areas"])

    recommended = {
        topic["id"]
        for topic in sorted(
            (item for item in topics if item["id"] != "free" and score(item) > 0),
            key=score,
            reverse=True,
        )[:3]
    }
    result = [
        dict(
            topic,
            recommended=topic["id"] in recommended,
            aboveLevel=LEVELS.index(topic["recommendedFrom"]) > LEVELS.index(level),
        )
        for topic in topics
    ]
    return sorted(result, key=lambda item: not item["recommended"])


def list_conversations(user_id):
    require_user(user_id)
    purge_expired(user_id)
    conversations = db.session.scalars(
        select(Conversation)
        .where(
            Conversation.user_id == user_id,
            Conversation.retention == "saved",
            Conversation.content_deleted_at.is_(None),
        )
        .order_by(Conversation.updated_at.desc())
    )
    return [_summary(item) for item in conversations]


def start(user_id, topic_id):
    if not isinstance(topic_id, str) or not 1 <= len(topic_id) <= 80:
        raise AppError("VALIDATION", "Escolha um assunto válido.")
    bundle = learner_bundle(user_id)
    topic = catalog.topic(topic_id)
    if topic is None:
        raise AppError("NOT_FOUND", "Assunto não encontrado.", 404)
    lesson = catalog.lesson(topic_id[7:]) if topic_id.startswith("lesson:") else None
    data = {"learner": bundle["learner"], "topic": topic}
    if lesson:
        data["lessonOpener"] = lesson["practice"]["opener"]
    opening = get_ai_service().start_conversation(data)
    saved = db.session.get(
        Preferences, user_id, populate_existing=True
    ).save_conversation_history
    clock = now()
    timestamp = iso(clock)
    conversation = Conversation(
        id=new_id(),
        user_id=user_id,
        topic_id=topic_id,
        title=topic["title"],
        level_at_start=bundle["learner"]["level"],
        context=sanitize_context(opening["context"]),
        retention="saved" if saved else "ephemeral",
        expires_at=iso(
            clock
            + timedelta(
                days=current_app.config.get("CONVERSATION_RETENTION_DAYS", 90)
                if saved
                else 1
            )
        ),
        user_message_count=0,
        corrected_skills=[],
        content_deleted_at=None,
        created_at=timestamp,
        updated_at=timestamp,
        ended_at=None,
    )
    message = _new_message(
        conversation.id,
        "assistant",
        opening["reply"],
        timestamp,
        translation=opening.get("translation"),
        metadata=opening["ai"],
    )
    try:
        db.session.add(conversation)
        db.session.flush()
        db.session.add(message)
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise AppError(
            "PERSISTENCE_FAILED",
            "Não foi possível salvar a conversa. Tente novamente.",
            503,
        ) from exc
    return dict(
        _summary(conversation, [message]),
        level=conversation.level_at_start,
        messages=[message.to_dict()],
        ai=get_ai_service().metadata(),
    )


def get(user_id, conversation_id):
    conversation = _owned(user_id, conversation_id)
    messages = _messages(conversation_id)
    return dict(
        _summary(conversation, messages),
        level=conversation.level_at_start,
        messages=[item.to_dict() for item in messages],
        ai=get_ai_service().metadata(),
        contentDeleted=bool(conversation.content_deleted_at),
    )


def _request_fingerprint(text):
    # A keyed digest detects changed private text without retaining that text or
    # exposing an enumerable digest of redacted passwords, numbers or addresses.
    secret = current_app.config["SECRET_KEY"]
    secret = secret.encode() if isinstance(secret, str) else secret
    return hmac.new(secret, text.encode(), hashlib.sha256).hexdigest()


def _replay_turn(conversation_id, key, fingerprint):
    if key is None:
        return None
    messages = list(
        db.session.scalars(
            select(Message).where(
                Message.conversation_id == conversation_id,
                Message.idempotency_key == key,
            )
        )
    )
    if not messages:
        return None
    pair = {message.role: message for message in messages}
    user_message = pair.get("user")
    assistant_message = pair.get("assistant")
    if user_message is None or assistant_message is None:
        raise AppError(
            "PERSISTENCE_FAILED",
            "Não foi possível recuperar o envio. Recarregue a conversa.",
            503,
        )
    if not hmac.compare_digest(user_message.request_fingerprint or "", fingerprint):
        raise AppError(
            "IDEMPOTENCY_CONFLICT",
            "Esta chave já foi usada para outra mensagem. Envie a nova mensagem com uma nova chave.",
            409,
        )
    return {
        "userMessage": user_message.to_dict(),
        "assistantMessage": assistant_message.to_dict(),
        "ai": assistant_message.reply_metadata,
    }


def send(user_id, conversation_id, raw_text, idempotency_key=None):
    conversation = _owned(user_id, conversation_id, require_content=True)
    if (
        not isinstance(raw_text, str)
        or not raw_text.strip()
        or len(raw_text.strip()) > 600
    ):
        raise AppError(
            "VALIDATION",
            "Escreva uma mensagem de até 600 caracteres.",
            fields={"text": "Escreva uma mensagem de até 600 caracteres."},
        )
    if idempotency_key is not None and (
        not isinstance(idempotency_key, str)
        or not re.fullmatch(r"[A-Za-z0-9._:-]{1,128}", idempotency_key)
    ):
        raise AppError(
            "VALIDATION", "A chave de envio deve conter de 1 a 128 caracteres válidos."
        )
    fingerprint = _request_fingerprint(raw_text.strip()) if idempotency_key else None
    replay = _replay_turn(conversation_id, idempotency_key, fingerprint)
    if replay:
        return replay
    if conversation.ended_at:
        raise AppError("CONVERSATION_ENDED", "Esta conversa já foi encerrada.", 409)
    bundle = learner_bundle(user_id)
    topic = catalog.topic(conversation.topic_id)
    if topic is None:
        raise AppError("NOT_FOUND", "Assunto não encontrado.", 404)
    redacted = redact_sensitive_data(raw_text.strip())
    text = redacted["text"]
    context = sanitize_context(conversation.context)
    expected_count = conversation.user_message_count
    corrected_skills = list(conversation.corrected_skills or [])
    history = [
        {"role": item.role, "content": redact_sensitive_data(item.content)["text"]}
        for item in _messages(conversation_id)[
            -current_app.config.get("AI_MAX_HISTORY_MESSAGES", 12) :
        ]
    ]
    turn = get_ai_service().conversation(
        {
            "learner": bundle["learner"],
            "topic": topic,
            "context": context,
            "history": history,
            "userMessage": text,
        }
    )
    decision = decide_conversation_corrections(
        turn["issues"],
        bundle["preferences"].correction_intensity,
        bundle["learner"]["level"],
        context["turnsSinceInlineCorrection"],
    )
    include_tip = (
        policy_for(bundle["learner"]["level"])["includeTipByDefault"]
        or bundle["preferences"].correction_intensity == "detailed"
    )

    def corrections(issues):
        # One entry per skill preserves repeated-error review accounting.
        skills = dict.fromkeys(item["skillTag"] for item in issues)
        return [
            build_correction(
                text,
                [item for item in issues if item["skillTag"] == skill],
                bundle["learner"]["explanationLanguage"],
                include_tip,
            )
            for skill in skills
        ]

    timestamp = iso(
        max(
            now(),
            datetime.fromisoformat(conversation.updated_at.replace("Z", "+00:00"))
            + timedelta(milliseconds=1),
        )
    )
    notice = privacy_notice(redacted["redactedKinds"])
    user_message = _new_message(
        conversation_id,
        "user",
        text,
        timestamp,
        corrections=corrections(decision["inline"]),
        deferred=corrections(decision["deferred"]),
        notices=[notice] if notice else [],
    )
    # A distinct timestamp keeps deterministic message order without relying on UUIDs.
    assistant_message = _new_message(
        conversation_id,
        "assistant",
        turn["reply"],
        iso(
            datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            + timedelta(milliseconds=1)
        ),
        translation=turn.get("translation"),
        metadata=turn["ai"],
    )
    if idempotency_key:
        user_message.idempotency_key = assistant_message.idempotency_key = (
            idempotency_key
        )
        user_message.request_fingerprint = fingerprint
        assistant_message.reply_metadata = turn["ai"]
    updated_context = sanitize_context(turn["context"])
    updated_context["turnsSinceInlineCorrection"] = (
        0 if decision["inline"] else context["turnsSinceInlineCorrection"] + 1
    )
    corrected_skills += [
        item["skillTag"] for item in decision["inline"] + decision["deferred"]
    ]
    # Optimistic claim prevents both concurrent turns and content resurrection.
    try:
        preferences = db.session.get(Preferences, user_id, populate_existing=True)
        values = {
            "context": updated_context,
            "user_message_count": expected_count + 1,
            "corrected_skills": corrected_skills[-50:],
            "updated_at": assistant_message.created_at,
        }
        if not preferences.save_conversation_history:
            values["retention"] = "ephemeral"
            values["expires_at"] = min(
                conversation.expires_at or iso(now() + timedelta(days=1)),
                iso(now() + timedelta(days=1)),
            )
        changed = db.session.execute(
            update(Conversation)
            .where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
                Conversation.user_message_count == expected_count,
                Conversation.content_deleted_at.is_(None),
                Conversation.ended_at.is_(None),
                or_(
                    Conversation.expires_at.is_(None),
                    Conversation.expires_at > timestamp,
                ),
            )
            .values(**values)
            .execution_options(synchronize_session=False)
        )
        if changed.rowcount != 1:
            db.session.rollback()
            _owned(user_id, conversation_id, require_content=True)
            replay = _replay_turn(conversation_id, idempotency_key, fingerprint)
            if replay:
                return replay
            raise AppError(
                "CONVERSATION_CHANGED",
                "A conversa foi atualizada ou encerrada. Recarregue antes de enviar novamente.",
                409,
            )
        db.session.add_all([user_message, assistant_message])
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        # Another request with this key can have committed while this request
        # awaited the provider. Recover its pair instead of returning a conflict.
        if idempotency_key:
            _owned(user_id, conversation_id, require_content=True)
            replay = _replay_turn(conversation_id, idempotency_key, fingerprint)
            if replay:
                return replay
        raise AppError(
            "PERSISTENCE_FAILED",
            "Não foi possível salvar a mensagem e a resposta. Tente novamente.",
            503,
        ) from exc
    return {
        "userMessage": user_message.to_dict(),
        "assistantMessage": assistant_message.to_dict(),
        "ai": turn["ai"],
    }


def end(user_id, conversation_id):
    conversation = _owned(user_id, conversation_id)
    messages = _messages(conversation_id)
    user_messages = [item for item in messages if item.role == "user"]
    corrections = [
        correction
        for item in user_messages
        for correction in (item.corrections or []) + (item.deferred_corrections or [])
    ]
    timestamp = now_iso()
    if not conversation.ended_at:
        conversation.ended_at = timestamp
        counts = {}
        for correction in corrections:
            if correction["severity"] != "naturalness":
                counts[correction["skillTag"]] = (
                    counts.get(correction["skillTag"], 0) + 1
                )
        for skill, count in counts.items():
            pending = db.session.scalar(
                select(Review.id).where(
                    Review.user_id == user_id,
                    Review.kind == "skill",
                    Review.ref_id == skill,
                    Review.status == "pending",
                )
            )
            if count >= 2 and not pending:
                db.session.add(
                    Review(
                        id=new_id(),
                        user_id=user_id,
                        kind="skill",
                        ref_id=skill,
                        reason="conversation",
                        status="pending",
                        due_at=timestamp,
                        interval_step=0,
                        times_reviewed=0,
                        last_score=None,
                        time_spent_seconds=0,
                        last_reviewed_at=None,
                        created_at=timestamp,
                    )
                )
    unique = list({item["suggestion"]: item for item in corrections}.values())
    suggestions = []
    for skill in dict.fromkeys(item["skillTag"] for item in unique):
        lesson_id = catalog.SKILL_LESSON.get(skill)
        lesson = catalog.lesson(lesson_id) if lesson_id else None
        if lesson:
            suggestions.append(
                {"lessonId": lesson_id, "title": lesson["title"], "skillTag": skill}
            )
    first = datetime.fromisoformat(
        (messages[0].created_at if messages else conversation.created_at).replace(
            "Z", "+00:00"
        )
    )
    # Content cleanup can happen long after practice; its ended_at timestamp is
    # a privacy event, while updated_at remains the last actual conversation turn.
    last = datetime.fromisoformat(
        (messages[-1].created_at if messages else conversation.updated_at).replace(
            "Z", "+00:00"
        )
    )
    result = {
        "conversationId": conversation_id,
        "title": conversation.title,
        "userMessages": len(user_messages)
        if not conversation.content_deleted_at
        else conversation.user_message_count,
        "durationMinutes": max(1, round((last - first).total_seconds() / 60)),
        "cleanMessages": None
        if conversation.content_deleted_at
        else sum(
            not item.corrections and not item.deferred_corrections
            for item in user_messages
        ),
        "corrections": unique[:6],
        "suggestedLessons": suggestions[:3],
        "contentDeleted": bool(conversation.content_deleted_at),
        "feedbackAvailable": not bool(conversation.content_deleted_at),
    }
    preferences = db.session.get(Preferences, user_id)
    if (
        conversation.retention == "ephemeral"
        or not preferences.save_conversation_history
    ) and not conversation.content_deleted_at:
        _delete_content(conversation, timestamp)
        result["contentDeleted"] = True
    try:
        db.session.commit()
    except SQLAlchemyError as exc:
        db.session.rollback()
        raise AppError(
            "PERSISTENCE_FAILED",
            "Não foi possível salvar o encerramento. Tente novamente.",
            503,
        ) from exc
    return result


def remove(user_id, conversation_id):
    conversation = _owned(user_id, conversation_id)
    if not conversation.content_deleted_at:
        _delete_content(conversation)
        db.session.commit()


def remove_all(user_id):
    require_user(user_id)
    conversations = list(
        db.session.scalars(
            select(Conversation).where(
                Conversation.user_id == user_id,
                Conversation.content_deleted_at.is_(None),
            )
        )
    )
    for conversation in conversations:
        _delete_content(conversation)
    db.session.commit()
    return len(conversations)


def purge_expired(user_id=None):
    statement = select(Conversation).where(
        Conversation.content_deleted_at.is_(None),
        Conversation.expires_at.is_not(None),
        Conversation.expires_at <= now_iso(),
    )
    if user_id is not None:
        statement = statement.where(Conversation.user_id == user_id)
    conversations = list(db.session.scalars(statement))
    for conversation in conversations:
        _delete_content(conversation)
    db.session.commit()
    return len(conversations)
