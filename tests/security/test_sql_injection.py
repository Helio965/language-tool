"""SQLi regressions against synthetic SQLite only, with observed SQL bindings.

The payloads use boolean expressions, comments, UNION and stacked SELECTs;
none requests deletion, schema changes, external access or expensive queries.
The delay sentinel counts calls without sleeping. It proves non-execution in
SQLite, rather than claiming timing coverage for a different database engine.
"""

from collections.abc import Mapping
from urllib.parse import quote, urlencode

import pytest
from sqlalchemy import event, func, select

from content import catalog
from extensions import db
from models import (
    Conversation,
    ExerciseAttempt,
    Message,
    PasswordResetToken,
    Review,
    User,
)
from services.common import now_iso


PASSWORD = "SyntheticAudit2026"
EMAIL_PAYLOADS = (
    "missing'/**/OR/**/1=1--@example.test",
    "missing'/**/OR/**/1=0--@example.test",
    "missing'/**/UNION/**/SELECT/**/1--@example.test",
    "missing';SELECT/**/1--@example.test",
)
ID_PAYLOADS = (
    "missing' OR 1=1--",
    "missing' OR 1=0--",
    "missing' UNION SELECT 1--",
    "missing';SELECT 1--",
)


def _contains(value, fragment):
    if isinstance(value, str):
        return fragment in value
    if isinstance(value, Mapping):
        return any(_contains(item, fragment) for item in value.values())
    if isinstance(value, (tuple, list)):
        return any(_contains(item, fragment) for item in value)
    return False


def assert_data_only(records, payload, *, bound=False, ignored=False):
    """Failure messages deliberately omit captured parameters and credentials."""
    found_binding = False
    for statement, parameters in records:
        if payload in statement:
            raise AssertionError("A request value reached an SQL template.")
        found_binding |= _contains(parameters, payload)
    if bound and not found_binding:
        raise AssertionError(
            "The expected request value was not observed as a binding."
        )
    if ignored and found_binding:
        raise AssertionError("An unsupported filter unexpectedly reached the database.")


def register(client, *, name="Synthetic Audit", email="apostrophe@example.test"):
    return client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": PASSWORD,
            "passwordConfirmation": PASSWORD,
            "acceptedTerms": True,
        },
    )


def start_conversation(client):
    response = client.post("/api/conversations", json={"topicId": "introductions"})
    assert response.status_code == 201
    return response.get_json()["id"]


def user_ids(application):
    with application.app_context():
        return set(db.session.scalars(select(User.id)))


@pytest.mark.parametrize(
    "payload", EMAIL_PAYLOADS, ids=("true", "false", "union", "stacked-select")
)
def test_login_and_reset_email_payloads_are_bound_not_executed(
    audit_app, audit_accounts, audit_client_factory, sql_capture, payload
):
    original_ids = user_ids(audit_app)
    outsider = audit_client_factory()
    sql_capture.clear()
    response = outsider.post(
        "/api/auth/login", json={"email": payload, "password": PASSWORD}
    )
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert outsider.get("/api/auth/session").get_json()["account"] is None
    assert_data_only(sql_capture, payload)
    assert_data_only(sql_capture, payload.lower(), bound=True)

    sql_capture.clear()
    response = outsider.post("/api/auth/password-reset", json={"email": payload})
    assert response.status_code == 202
    assert_data_only(sql_capture, payload)
    assert_data_only(sql_capture, payload.lower(), bound=True)
    with audit_app.app_context():
        assert (
            db.session.scalar(select(func.count()).select_from(PasswordResetToken)) == 0
        )
    assert user_ids(audit_app) == original_ids

    # Positive control: the known synthetic credentials still authenticate A only.
    response = outsider.post(
        "/api/auth/login",
        json={"email": audit_accounts[0]["email"], "password": PASSWORD},
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["id"] == audit_accounts[0]["user_id"]


@pytest.mark.parametrize(
    "name",
    ("Ana D'Ávila", "Synthetic ' OR 1=1--"),
    ids=("legitimate-apostrophe", "sql-like-name"),
)
def test_registration_preserves_literal_names_without_breaking_authentication(
    audit_app, audit_client, audit_client_factory, sql_capture, name
):
    response = register(audit_client, name=name)
    assert response.status_code == 201
    identifier = response.get_json()["user"]["id"]
    assert response.get_json()["user"]["name"] == name
    assert_data_only(sql_capture, name, bound=True)
    sql_capture.clear()
    response = audit_client.put(
        "/api/me/profile",
        json={
            "goal": "basics",
            "perceivedLevel": "beginner",
            "priorExperience": "none",
            "conversationInterest": True,
            "professionalInterest": False,
            "interestAreas": ["education"],
        },
    )
    assert response.status_code == 200
    assert response.get_json()["goal"] == "basics"
    assert audit_client.get("/api/me").get_json()["user"]["name"] == name
    outsider = audit_client_factory()
    response = outsider.post(
        "/api/auth/login",
        json={"email": "apostrophe@example.test", "password": PASSWORD},
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["id"] == identifier
    assert_data_only(sql_capture, name)
    with audit_app.app_context():
        assert db.session.get(User, identifier).name == name
        assert db.session.scalar(select(func.count()).select_from(User)) == 1


def test_sql_like_email_can_be_registered_only_as_its_literal_account(
    audit_app, audit_accounts, audit_client_factory, sql_capture
):
    payload = EMAIL_PAYLOADS[0]
    client = audit_client_factory()
    original_ids = user_ids(audit_app)
    sql_capture.clear()
    created = register(client, email=payload)
    assert created.status_code == 201
    identifier = created.get_json()["user"]["id"]
    assert identifier not in original_ids
    assert created.get_json()["user"]["email"] == payload.lower()
    assert_data_only(sql_capture, payload)
    assert_data_only(sql_capture, payload.lower(), bound=True)

    fresh = audit_client_factory()
    sql_capture.clear()
    denied = fresh.post(
        "/api/auth/login", json={"email": payload, "password": "WrongAudit2026"}
    )
    assert denied.status_code == 401
    response = fresh.post(
        "/api/auth/login", json={"email": payload, "password": PASSWORD}
    )
    assert response.status_code == 200
    assert response.get_json()["user"]["id"] == identifier
    assert_data_only(sql_capture, payload)
    assert_data_only(sql_capture, payload.lower(), bound=True)
    assert user_ids(audit_app) == original_ids | {identifier}


def test_sql_like_password_cannot_bypass_the_known_accounts_hash(
    audit_accounts, audit_client_factory, sql_capture
):
    outsider = audit_client_factory()
    password = "Synthetic2026' OR 1=1--"
    sql_capture.clear()
    response = outsider.post(
        "/api/auth/login",
        json={"email": audit_accounts[0]["email"], "password": password},
    )
    assert response.status_code == 401
    assert outsider.get("/api/auth/session").get_json()["account"] is None
    # Password verification stays local; raw password is not an SQL operand.
    assert_data_only(sql_capture, password, ignored=True)


@pytest.mark.parametrize(
    "payload", ID_PAYLOADS, ids=("true", "false", "union", "stacked-select")
)
def test_resource_identifier_payloads_cannot_select_or_modify_other_records(
    audit_app, audit_accounts, sql_capture, payload
):
    client = audit_accounts[0]["client"]
    owner = audit_accounts[1]["client"]
    conversation_id = start_conversation(owner)
    with audit_app.app_context():
        review = Review(
            id="synthetic-owner-b-review",
            user_id=audit_accounts[1]["user_id"],
            kind="lesson",
            ref_id="greetings",
            reason="low_score",
            status="pending",
            due_at=now_iso(),
            created_at=now_iso(),
        )
        db.session.add(review)
        db.session.commit()
    encoded = quote(payload, safe="")

    for method, path, data in (
        ("GET", f"/api/conversations/{encoded}", None),
        ("POST", f"/api/conversations/{encoded}/messages", {"text": "Hello."}),
        ("POST", f"/api/conversations/{encoded}/end", {}),
        ("DELETE", f"/api/conversations/{encoded}", None),
        ("POST", f"/api/reviews/{encoded}/session", {}),
        (
            "POST",
            f"/api/reviews/{encoded}/answers",
            {"exerciseId": "greetings-1", "answer": "Hello"},
        ),
        ("POST", f"/api/reviews/{encoded}/complete", {}),
    ):
        sql_capture.clear()
        kwargs = {"json": data} if data is not None else {}
        response = client.open(path, method, **kwargs)
        assert response.status_code == 404
        assert_data_only(sql_capture, payload, bound=True)

    for method, path in (
        ("GET", f"/api/lessons/{encoded}"),
        ("POST", f"/api/lessons/{encoded}/start"),
        ("GET", f"/api/vocabulary/{encoded}"),
        ("PUT", f"/api/vocabulary/{encoded}/status"),
        ("POST", f"/api/lessons/greetings/exercises/{encoded}/answer"),
    ):
        sql_capture.clear()
        response = client.open(
            path, method, json={"status": "learned", "answer": "Hello"}
        )
        assert response.status_code == 404
        assert_data_only(sql_capture, payload, ignored=True)

    retained = owner.get(f"/api/conversations/{conversation_id}")
    assert retained.status_code == 200
    assert len(retained.get_json()["messages"]) == 1
    assert retained.get_json()["endedAt"] is None
    with audit_app.app_context():
        assert db.session.get(Review, "synthetic-owner-b-review").status == "pending"
        assert db.session.scalar(select(func.count()).select_from(Conversation)) == 1
        assert db.session.scalar(select(func.count()).select_from(Message)) == 1
        assert db.session.scalar(select(func.count()).select_from(User)) == 2


def test_exercise_answer_and_idempotency_key_remain_data_on_replay_and_reload(
    audit_app, audit_accounts, sql_capture
):
    client = audit_accounts[0]["client"]
    other = audit_accounts[1]["client"]
    answer = "Synthetic answer ' OR 1=1--"
    key = "synthetic-key';SELECT 1--"
    exercise_id = catalog.lesson("greetings")["exercises"][0]["id"]
    assert client.post("/api/lessons/greetings/start").status_code == 204
    path = f"/api/lessons/greetings/exercises/{exercise_id}/answer"
    sql_capture.clear()
    first = client.post(path, json={"answer": answer}, headers={"Idempotency-Key": key})
    assert first.status_code == 200
    assert_data_only(sql_capture, answer, bound=True)
    assert_data_only(sql_capture, key, bound=True)

    sql_capture.clear()
    replay = client.post(
        path, json={"answer": answer}, headers={"Idempotency-Key": key}
    )
    assert replay.status_code == 200
    assert replay.get_json() == first.get_json()
    assert_data_only(sql_capture, key, bound=True)
    for _ in range(2):
        assert client.get("/api/lessons/greetings").status_code == 200
        assert client.get("/api/progress").status_code == 200
        assert client.get("/api/reviews").status_code == 200
    assert_data_only(sql_capture, answer)
    with audit_app.app_context():
        attempts = list(db.session.scalars(select(ExerciseAttempt)))
        assert len(attempts) == 1
        assert attempts[0].answer == answer
        assert attempts[0].idempotency_key == key
        assert attempts[0].user_id == audit_accounts[0]["user_id"]
    assert other.get("/api/lessons/greetings").get_json()["answeredExerciseIds"] == []


def test_conversation_message_stays_literal_after_replay_history_and_end(
    audit_app, audit_accounts, sql_capture
):
    client = audit_accounts[0]["client"]
    other = audit_accounts[1]["client"]
    identifier = start_conversation(client)
    message = "I am learning English. ' UNION SELECT 1; SELECT 2--"
    path = f"/api/conversations/{identifier}/messages"
    sql_capture.clear()
    first = client.post(
        path, json={"text": message}, headers={"Idempotency-Key": "synthetic-turn-1"}
    )
    assert first.status_code == 201
    assert first.get_json()["userMessage"]["content"] == message
    assert_data_only(sql_capture, message, bound=True)

    sql_capture.clear()
    replay = client.post(
        path, json={"text": message}, headers={"Idempotency-Key": "synthetic-turn-1"}
    )
    assert replay.status_code == 201
    assert replay.get_json() == first.get_json()
    for _ in range(2):
        history = client.get(f"/api/conversations/{identifier}").get_json()["messages"]
        assert len(history) == 3
        assert (
            next(item for item in history if item["role"] == "user")["content"]
            == message
        )
    assert client.post(f"/api/conversations/{identifier}/end").status_code == 200
    assert_data_only(sql_capture, message)
    assert other.get("/api/conversations").get_json() == []
    assert other.get(f"/api/conversations/{identifier}").status_code == 404
    with audit_app.app_context():
        assert db.session.scalar(select(func.count()).select_from(Message)) == 3
        assert (
            db.session.scalar(select(Message.content).where(Message.role == "user"))
            == message
        )


def test_unsupported_query_filters_and_sorting_do_not_reach_sql(
    audit_accounts, sql_capture
):
    client = audit_accounts[0]["client"]
    other = audit_accounts[1]["client"]
    start_conversation(client)
    start_conversation(other)
    payload = "synthetic-filter' UNION SELECT 1; SELECT 2--"
    query = urlencode(
        {
            "search": payload,
            "filter": payload,
            "where": payload,
            "sort": payload,
            "order": payload,
            "limit": payload,
            "userId": audit_accounts[1]["user_id"],
        }
    )
    for path in (
        "/api/conversations",
        "/api/lessons",
        "/api/vocabulary",
        "/api/reviews",
        "/api/progress",
    ):
        baseline = client.get(path)
        assert baseline.status_code == 200
        sql_capture.clear()
        response = client.get(f"{path}?{query}")
        assert response.status_code == 200
        assert response.get_json() == baseline.get_json()
        assert_data_only(sql_capture, payload, ignored=True)
    assert len(client.get("/api/conversations").get_json()) == 1


def test_blind_delay_expression_never_executes_sqlite_sentinel(
    audit_app, audit_accounts, audit_client_factory, sql_capture
):
    calls = []

    def sentinel():
        calls.append(True)
        return 0

    def install(connection, _record):
        connection.create_function("audit_delay", 0, sentinel)

    with audit_app.app_context():
        engine = db.engine
        event.listen(engine, "connect", install)
        with engine.connect() as connection:
            install(connection.connection.driver_connection, None)
            # Positive control verifies the function works without a sleep/load test.
            assert connection.exec_driver_sql("SELECT audit_delay()").scalar() == 0
    assert len(calls) == 1
    calls.clear()
    try:
        email = "missing'/**/OR/**/audit_delay()=0--@example.test"
        sql_capture.clear()
        response = audit_client_factory().post(
            "/api/auth/login", json={"email": email, "password": PASSWORD}
        )
        assert response.status_code == 401
        assert_data_only(sql_capture, email)
        assert_data_only(sql_capture, email.lower(), bound=True)

        identifier = "missing' OR audit_delay()=0--"
        sql_capture.clear()
        response = audit_accounts[0]["client"].get(
            f"/api/conversations/{quote(identifier, safe='')}"
        )
        assert response.status_code == 404
        assert_data_only(sql_capture, identifier, bound=True)
        assert calls == []
    finally:
        event.remove(engine, "connect", install)
