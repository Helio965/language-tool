"""Prove the test boundary before using any SQL probes."""

from pathlib import Path

from sqlalchemy import inspect, select, func

from extensions import db
from models import User


def test_audit_uses_only_temporary_sqlite_and_disabled_integrations(
    audit_app, audit_client, tmp_path
):
    assert audit_app.config["APP_ENV"] == "testing"
    assert audit_app.config["ANTHROPIC_API_KEY"] == ""
    assert audit_app.config["MAIL_TRANSPORT"] == "disabled"
    assert Path(audit_app.instance_path).is_relative_to(tmp_path)
    with audit_app.app_context():
        assert db.engine.dialect.name == "sqlite"
        assert Path(db.engine.url.database).is_relative_to(tmp_path)
        assert len(inspect(db.engine).get_table_names()) == 15
        assert db.session.scalar(select(func.count()).select_from(User)) == 0
    assert audit_client.get("/api/health").status_code == 200
    assert not Path(audit_app.config["MAIL_OUTBOX_DIR"]).exists()


def test_synthetic_accounts_are_distinct_and_signed_csrf_is_enabled(
    audit_accounts, audit_app
):
    first, second = audit_accounts
    assert first["user_id"] != second["user_id"]
    for account in audit_accounts:
        assert (
            account["client"].get("/api/me").get_json()["user"]["id"]
            == account["user_id"]
        )
        assert (
            account["client"]
            .patch("/api/me/preferences", csrf=False, json={"dailyGoalMinutes": 5})
            .status_code
            == 400
        )
    assert audit_app.config["WTF_CSRF_ENABLED"] is True
