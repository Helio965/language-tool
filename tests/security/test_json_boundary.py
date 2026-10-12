"""Malformed JSON must fail before hashing, provider calls or database writes."""

import json

import pytest
from sqlalchemy import func, select

from extensions import db
from models import User, UserVocabulary


@pytest.mark.parametrize("number", ["NaN", "Infinity", "-Infinity", "1e999"])
def test_non_finite_json_numbers_are_rejected_without_changing_preferences(
    audit_accounts, number
):
    account, _ = audit_accounts
    client = account["client"]
    before = client.get("/api/me/preferences").get_json()
    response = client.patch(
        "/api/me/preferences",
        data='{"dailyGoalMinutes":' + number + "}",
        content_type="application/json",
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION"
    assert client.get("/api/me/preferences").get_json() == before


@pytest.mark.parametrize(
    "payload", [{"unknown": "\ud800"}, {"\udfff": "safe"}, {"unknown": ["\udc00"]}]
)
def test_invalid_unicode_in_values_keys_or_nested_arrays_is_rejected(
    audit_accounts, payload
):
    account, _ = audit_accounts
    client = account["client"]
    before = client.get("/api/me/preferences").get_json()
    response = client.patch(
        "/api/me/preferences", data=json.dumps(payload), content_type="application/json"
    )
    assert response.status_code == 400
    assert client.get("/api/me/preferences").get_json() == before


@pytest.mark.parametrize("depth", [65, 1100])
def test_excessive_nesting_fails_safely_before_a_write(audit_accounts, depth):
    account, _ = audit_accounts
    client = account["client"]
    before = client.get("/api/me/preferences").get_json()
    payload = '{"unknown":' + "[" * depth + "0" + "]" * depth + "}"
    assert len(payload) < 16 * 1024
    response = client.patch(
        "/api/me/preferences", data=payload, content_type="application/json"
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "VALIDATION"
    assert client.get("/api/me/preferences").get_json() == before


def test_legitimate_unicode_apostrophes_and_finite_numbers_still_work(
    audit_client, audit_app
):
    response = audit_client.post(
        "/api/auth/register",
        json={
            "name": "D'Ávila 😀",
            "email": "d'avila@example.test",
            "password": "SyntheticAudit2026",
            "passwordConfirmation": "SyntheticAudit2026",
            "acceptedTerms": True,
        },
    )
    assert response.status_code == 201
    assert response.get_json()["user"]["name"] == "D'Ávila 😀"
    response = audit_client.patch(
        "/api/me/preferences",
        json={"dailyGoalMinutes": 15, "unused": {"values": [0.5, 1, True, None]}},
    )
    assert response.status_code == 200
    assert response.get_json()["dailyGoalMinutes"] == 15
    with audit_app.app_context():
        assert db.session.scalar(select(func.count()).select_from(User)) == 1
        assert db.session.scalar(select(func.count()).select_from(UserVocabulary)) == 0
