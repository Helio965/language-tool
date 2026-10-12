"""Authorization also binds requests to signed sessions and per-session CSRF."""


def test_csrf_from_a_different_session_cannot_change_preferences(audit_accounts):
    first, second = audit_accounts
    token = first["client"].get("/api/csrf").get_json()["csrfToken"]
    before = second["client"].get("/api/me/preferences").get_json()
    response = second["client"].patch(
        "/api/me/preferences",
        csrf=False,
        headers={"X-CSRFToken": token},
        json={"dailyGoalMinutes": 30},
    )
    assert response.status_code == 400
    assert response.get_json()["error"]["code"] == "CSRF"
    assert second["client"].get("/api/me/preferences").get_json() == before


def test_account_pin_and_sql_like_header_cannot_substitute_the_cookie_owner(
    audit_accounts,
):
    first, second = audit_accounts
    for identity in (first["user_id"], "synthetic' OR 1=1--"):
        response = second["client"].get("/api/me", headers={"X-Session-User": identity})
        assert response.status_code == 401
        assert first["user_id"] not in response.get_data(as_text=True)
        assert second["user_id"] not in response.get_data(as_text=True)
    assert second["client"].get("/api/me").get_json()["user"]["id"] == second["user_id"]


def test_tampered_session_signature_cannot_read_private_data(
    audit_accounts, audit_app, audit_client_factory
):
    first, _ = audit_accounts
    name = audit_app.config["SESSION_COOKIE_NAME"]
    cookie = first["client"].client.get_cookie(name).value
    payload, signature = cookie.rsplit(".", 1)
    changed = ("A" if signature[0] != "A" else "B") + signature[1:]
    outsider = audit_client_factory()
    outsider.client.set_cookie(name, payload + "." + changed)
    response = outsider.get("/api/me")
    assert response.status_code == 401
    assert first["user_id"] not in response.get_data(as_text=True)
    assert outsider.get("/api/auth/session").get_json()["account"] is None


def test_logout_revokes_a_copied_session_without_revoking_another_account(
    audit_accounts, audit_app, audit_client_factory
):
    first, second = audit_accounts
    name = audit_app.config["SESSION_COOKIE_NAME"]
    copy = audit_client_factory()
    copy.client.set_cookie(name, first["client"].client.get_cookie(name).value)
    assert copy.get("/api/me").status_code == 200
    assert first["client"].post("/api/auth/logout").status_code == 204
    assert copy.get("/api/me").status_code == 401
    assert second["client"].get("/api/me").get_json()["user"]["id"] == second["user_id"]


def test_reset_request_does_not_enumerate_synthetic_accounts(
    audit_accounts, audit_client_factory
):
    first, _ = audit_accounts
    client = audit_client_factory()
    known = client.post("/api/auth/password-reset", json={"email": first["email"]})
    absent = client.post(
        "/api/auth/password-reset", json={"email": "absent-audit@example.test"}
    )
    assert known.status_code == absent.status_code == 202
    assert known.get_json() == absent.get_json()
    assert "token" not in known.get_json()
