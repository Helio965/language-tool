"""Security boundary tests against real persistence and signed sessions."""

from app import create_app


def register(client, name="Aluno Seguro", email="aluno@example.test"):
    return client.post(
        "/api/auth/register",
        json={
            "name": name,
            "email": email,
            "password": "TestPassword123",
            "passwordConfirmation": "TestPassword123",
            "acceptedTerms": True,
        },
    )


def test_signed_csrf_token_required(app):
    app.config["WTF_CSRF_ENABLED"] = True
    client = app.test_client()
    payload = {"email": "nobody@example.test", "password": "WrongPassword123"}
    assert client.post("/api/auth/login", json=payload).status_code == 400
    token = client.get("/api/csrf").get_json()["csrfToken"]
    assert (
        client.post(
            "/api/auth/login", json=payload, headers={"X-CSRFToken": token + "tampered"}
        ).status_code
        == 400
    )
    response = client.post(
        "/api/auth/login", json=payload, headers={"X-CSRFToken": token}
    )
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_account_binding_cannot_leak_new_cookie_account(client):
    first = register(client).get_json()["user"]["id"]
    client.post("/api/auth/logout")
    second = register(client, "Outro Aluno", "outro@example.test").get_json()["user"][
        "id"
    ]
    for path in ["/api/me", "/api/me/preferences", "/api/progress", "/api/home"]:
        response = client.get(path, headers={"X-Session-User": first})
        assert response.status_code == 401
        assert second not in response.get_data(as_text=True)
    assert client.get("/api/me", headers={"X-Session-User": second}).status_code == 200


def test_logout_revokes_copied_cookie(app):
    client = app.test_client()
    assert register(client).status_code == 201
    cookie_name = app.config["SESSION_COOKIE_NAME"]
    copied_cookie = client.get_cookie(cookie_name).value
    stale = app.test_client()
    stale.set_cookie(cookie_name, copied_cookie)
    assert stale.get("/api/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    assert stale.get("/api/me").status_code == 401


def test_read_only_logout_route_does_not_change_session(client):
    assert register(client).status_code == 201
    assert client.get("/api/auth/logout").status_code == 405
    assert client.get("/api/me").status_code == 200


def test_private_response_headers_and_cookie(client):
    registration = register(client)
    cookie = registration.headers.get("Set-Cookie", "")
    assert "HttpOnly" in cookie and "SameSite=Strict" in cookie
    response = client.get("/api/me")
    assert response.headers["Cache-Control"] == "no-store"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert "script-src 'self'" in response.headers["Content-Security-Policy"]
    assert "passwordHash" not in response.get_data(as_text=True)
    assert "sessionVersion" not in response.get_data(as_text=True)


def test_untrusted_body_and_size_are_rejected(client):
    assert (
        client.post("/api/auth/login", json=["not", "an", "object"]).status_code == 400
    )
    assert (
        client.post(
            "/api/auth/login", data='{"bad"', content_type="application/json"
        ).status_code
        == 400
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "x" * 18000, "password": "x"}
        ).status_code
        == 413
    )


def test_sql_payload_cannot_authenticate_or_modify_an_account(client, app):
    from extensions import db
    from models import User

    assert register(client).status_code == 201
    client.post("/api/auth/logout")
    response = client.post(
        "/api/auth/login",
        json={
            "email": "x'OR'1'='1@example.test",
            "password": "TestPassword123",
        },
    )
    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert client.get("/api/me").status_code == 401
    with app.app_context():
        assert db.session.query(User).count() == 1
        assert db.session.scalar(db.select(User.email)) == "aluno@example.test"


def test_stored_html_is_escaped_in_templates_and_json_context(client):
    malicious_name = '<script>alert("stored-xss")</script>'
    assert register(client, name=malicious_name).status_code == 201
    response = client.get("/configuracao")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    assert malicious_name not in html
    assert "\\u003cscript\\u003e" in html
    assert "script-src 'self'" in response.headers["Content-Security-Policy"]


def test_expired_signed_session_cannot_read_private_data(app, monkeypatch):
    from itsdangerous.timed import TimestampSigner

    client = app.test_client()
    assert register(client).status_code == 201
    clock = TimestampSigner(app.secret_key).get_timestamp()
    ttl = int(app.config["PERMANENT_SESSION_LIFETIME"].total_seconds())
    monkeypatch.setattr(TimestampSigner, "get_timestamp", lambda self: clock + ttl + 1)
    assert client.get("/api/me").status_code == 401
    assert client.get("/progresso").status_code == 302


def test_login_abuse_is_limited(tmp_path):
    app = create_app(
        {
            "TESTING": True,
            "SECRET_KEY": "test-rate-secret-at-least-32-characters",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'limited.db'}",
            "AUTO_INIT_DB": True,
            "WTF_CSRF_ENABLED": False,
            "RATELIMIT_ENABLED": True,
            "AI_PROVIDER": "mock",
            "MAIL_TRANSPORT": "disabled",
        }
    )
    client = app.test_client()
    responses = [
        client.post(
            "/api/auth/login",
            json={"email": "absent@example.test", "password": "NotValid123"},
        )
        for _ in range(21)
    ]
    assert all(response.status_code == 401 for response in responses[:20])
    assert responses[20].status_code == 429
    assert "Retry-After" in responses[20].headers
