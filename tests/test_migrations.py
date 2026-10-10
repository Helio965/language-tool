"""Real SQLite upgrades, adoption, resumability and source preservation."""

import hashlib
import json
import sqlite3
from pathlib import Path
from flask import Flask
from flask_migrate import upgrade
import pytest
from sqlalchemy import inspect
from extensions import db, migrate
from models import User, LearningProfile, Preferences
from models.migration import ROOT, initialize_database, import_legacy
from services.autenticacao import hash_password, verify_password
from content import catalog


def migration_app(path):
    app = Flask("migration-tests")
    app.config.update(
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{path}",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
    )
    db.init_app(app)
    migrate.init_app(app, db, directory=str(ROOT / "migrations"))
    return app


def original_database(path):
    with sqlite3.connect(path) as connection:
        connection.executescript((ROOT / "apps/api/src/db/schema.sql").read_text())
        connection.execute("ALTER TABLE users DROP COLUMN session_version")
        connection.execute(
            "INSERT INTO users(id,name,email,password_hash,role,created_at,terms_accepted_at) VALUES(?,?,?,?,?,?,?)",
            (
                "legacy-user",
                "Legacy Carla",
                "legacy@example.com",
                hash_password("legado123"),
                "user",
                "2025-01-01T00:00:00.000Z",
                "2025-01-01T00:00:00.000Z",
            ),
        )
        connection.execute(
            "INSERT INTO learning_profiles(user_id,interest_areas,difficulties,updated_at) VALUES(?,?,?,?)",
            (
                "legacy-user",
                '["technology"]',
                '["articles"]',
                "2025-01-01T00:00:00.000Z",
            ),
        )
        connection.execute(
            "INSERT INTO preferences(user_id,updated_at) VALUES(?,?)",
            ("legacy-user", "2025-01-01T00:00:00.000Z"),
        )


def populated_legacy_database(path):
    """A complete old catalog plus retained activity and customized cache content."""
    original_database(path)
    timestamp = "2025-01-01T00:00:00.000Z"
    encode = lambda value: json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    with sqlite3.connect(path) as connection:
        for word in catalog.vocabulary():
            connection.execute(
                "INSERT INTO vocabulary VALUES(?,?,?,?,?,?,?,?,?)",
                (
                    word["id"],
                    word["word"],
                    word["translation"],
                    word["meaning"],
                    word["partOfSpeech"],
                    word["level"],
                    word["topic"],
                    encode(word["examples"]),
                    word.get("phonetic"),
                ),
            )
        for lesson in catalog.lessons():
            connection.execute(
                "INSERT INTO lessons VALUES(?,?,?,?,?,?,?)",
                (
                    lesson["id"],
                    lesson["level"],
                    lesson["order"],
                    lesson["title"],
                    lesson["topic"],
                    encode(
                        {
                            key: value
                            for key, value in lesson.items()
                            if key != "exercises"
                        }
                    ),
                    lesson["estimatedMinutes"],
                ),
            )
            for exercise in lesson["exercises"]:
                connection.execute(
                    "INSERT INTO exercises VALUES(?,?,?,?,?,?,?)",
                    (
                        exercise["id"],
                        lesson["id"],
                        exercise["type"],
                        exercise["prompt"],
                        encode(exercise.get("options", [])),
                        encode(exercise["acceptedAnswers"]),
                        exercise["skillTag"],
                    ),
                )
            connection.executemany(
                "INSERT INTO lesson_vocabulary VALUES(?,?)",
                [(lesson["id"], word_id) for word_id in lesson["vocabularyIds"]],
            )
        lesson = catalog.lessons()[0]
        exercise = lesson["exercises"][0]
        word_id = lesson["vocabularyIds"][0]
        connection.execute(
            "UPDATE lessons SET title=?, content=? WHERE id=?",
            (
                "Título preservado do banco legado",
                '{ "nota": "conteúdo local personalizado" }',
                lesson["id"],
            ),
        )
        connection.execute(
            "UPDATE exercises SET prompt=?, accepted_answers=? WHERE id=?",
            (
                "Enunciado legado personalizado",
                '[ "resposta personalizada" ]',
                exercise["id"],
            ),
        )
        connection.execute(
            "UPDATE vocabulary SET translation=?, examples=? WHERE id=?",
            ("tradução legada personalizada", '[ "exemplo personalizado" ]', word_id),
        )
        connection.execute(
            "INSERT INTO progress(user_id,lesson_id,status,correct_count,total_count,score,time_spent_seconds,started_at,completed_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (
                "legacy-user",
                lesson["id"],
                "completed",
                2,
                3,
                67,
                240,
                timestamp,
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            "INSERT INTO exercise_attempts VALUES(?,?,?,?,?,?,?,?,?)",
            (
                "legacy-attempt",
                "legacy-user",
                exercise["id"],
                lesson["id"],
                exercise["skillTag"],
                "lesson",
                "Resposta histórica do aluno",
                0,
                timestamp,
            ),
        )
        connection.execute(
            "INSERT INTO user_vocabulary VALUES(?,?,?,?,?,?,?)",
            ("legacy-user", word_id, "learning", 2, timestamp, timestamp, timestamp),
        )
        connection.execute(
            "INSERT INTO reviews(id,user_id,kind,ref_id,reason,status,due_at,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (
                "legacy-review",
                "legacy-user",
                "lesson",
                lesson["id"],
                "low_score",
                "pending",
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            "INSERT INTO password_reset_tokens VALUES(?,?,?,?,?,?)",
            ("legacy-reset", "legacy-user", "a" * 64, timestamp, None, timestamp),
        )
        connection.execute(
            "INSERT INTO conversations(id,user_id,topic_id,title,level_at_start,context,retention,expires_at,user_message_count,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (
                "legacy-conversation",
                "legacy-user",
                "introductions",
                "Minha conversa antiga",
                "beginner",
                '{ "facts": { "city": "Recife" } }',
                "saved",
                "2099-01-01T00:00:00.000Z",
                1,
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            "INSERT INTO messages(id,conversation_id,role,content,created_at) VALUES(?,?,?,?,?)",
            (
                "legacy-message",
                "legacy-conversation",
                "user",
                "I live in Recife.",
                timestamp,
            ),
        )


def original_column_hashes(path, columns=None):
    with sqlite3.connect(path) as connection:
        if columns is None:
            tables = connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
            columns = {
                table: [
                    row[1]
                    for row in connection.execute(f'PRAGMA table_info("{table}")')
                ]
                for (table,) in tables
            }
        hashes = {}
        for table, names in columns.items():
            projection = ",".join(f'"{name}"' for name in names)
            rows = connection.execute(
                f'SELECT {projection} FROM "{table}" ORDER BY {projection}'
            ).fetchall()
            hashes[table] = (
                len(rows),
                hashlib.sha256(
                    json.dumps(rows, ensure_ascii=False).encode()
                ).hexdigest(),
            )
    return columns, hashes


def test_new_database_has_all_fourteen_tables_and_constraints(tmp_path):
    app = migration_app(tmp_path / "new.db")
    with app.app_context():
        initialize_database(app)
        initialize_database(app)
        tables = set(inspect(db.engine).get_table_names())
        assert len(tables - {"alembic_version"}) == 14
        assert "session_version" in {
            column["name"] for column in inspect(db.engine).get_columns("users")
        }
        assert "feedback" in {
            column["name"]
            for column in inspect(db.engine).get_columns("exercise_attempts")
        }
        assert db.session.execute(db.text("PRAGMA foreign_keys")).scalar() == 1
        assert db.session.execute(db.text("PRAGMA foreign_key_check")).first() is None


def test_legacy_copy_preserves_source_hashes_profiles_and_dates(tmp_path):
    source, destination = tmp_path / "original.db", tmp_path / "python.db"
    original_database(source)
    before = hashlib.sha256(source.read_bytes()).hexdigest()
    import_legacy(source, destination)
    app = migration_app(destination)
    with app.app_context():
        initialize_database(app)
        user = db.session.get(User, "legacy-user")
        assert verify_password("legado123", user.password_hash)
        assert user.created_at == "2025-01-01T00:00:00.000Z"
        assert user.session_version == 0
        assert db.session.get(LearningProfile, user.id).interest_areas == ["technology"]
        assert db.session.get(LearningProfile, user.id).difficulties == ["articles"]
        assert db.session.get(Preferences, user.id).show_translations is True
        checks = inspect(db.engine).get_check_constraints("exercise_attempts")
        assert any("context IN" in check["sqltext"] for check in checks)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == before
    with pytest.raises(ValueError, match="destino já existe"):
        import_legacy(source, destination)


def test_incompatible_legacy_schema_rejected_before_changes(tmp_path):
    path = tmp_path / "incomplete.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE users(id TEXT PRIMARY KEY)")
        connection.execute("INSERT INTO users VALUES('keep-me')")
    app = migration_app(path)
    with app.app_context(), pytest.raises(RuntimeError, match="incompleto"):
        initialize_database(app)
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT id FROM users").fetchone() == ("keep-me",)
        assert [row[1] for row in connection.execute("PRAGMA table_info(users)")] == [
            "id"
        ]


def test_invalid_legacy_json_is_rejected(tmp_path):
    path = tmp_path / "invalid-json.db"
    original_database(path)
    with sqlite3.connect(path) as connection:
        connection.execute("UPDATE learning_profiles SET interest_areas='invalid JSON'")
    app = migration_app(path)
    with app.app_context(), pytest.raises(RuntimeError, match="JSON inválido"):
        initialize_database(app)


def test_partial_second_upgrade_can_resume(tmp_path):
    app = migration_app(tmp_path / "resume.db")
    with app.app_context():
        upgrade(directory=str(ROOT / "migrations"), revision="0001_legacy_schema")
        with db.engine.begin() as connection:
            connection.exec_driver_sql(
                "ALTER TABLE progress ADD COLUMN passage_id VARCHAR"
            )
        initialize_database(app)
        assert (
            db.session.execute(
                db.text("SELECT version_num FROM alembic_version")
            ).scalar()
            == "0003_conversation_idempotency"
        )
        assert "completion_result" in {
            column["name"] for column in inspect(db.engine).get_columns("progress")
        }


def test_legacy_orphan_refused_and_no_destination_left(tmp_path):
    source, destination = tmp_path / "orphan.db", tmp_path / "destination.db"
    original_database(source)
    with sqlite3.connect(source) as connection:
        connection.execute("PRAGMA foreign_keys=OFF")
        connection.execute(
            "INSERT INTO learning_profiles(user_id,updated_at) VALUES('missing-user','2025-01-01T00:00:00.000Z')"
        )
    with pytest.raises(ValueError, match="órfãs"):
        import_legacy(source, destination)
    assert not destination.exists()


def test_import_cli_and_startup_preserve_every_original_column_and_row(tmp_path):
    from app import create_app

    source, destination = tmp_path / "source.db", tmp_path / "imported.db"
    populated_legacy_database(source)
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    original_columns, before = original_column_hashes(source)
    assert len(before) == 14
    assert all(count for count, _digest in before.values())
    config = {
        "TESTING": True,
        "MAIL_TRANSPORT": "memory",
        "RATELIMIT_ENABLED": False,
        "AUTO_INIT_DB": False,
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{destination}",
    }
    app = create_app(config)
    result = app.test_cli_runner().invoke(args=["import-legacy", str(source)])
    assert result.exit_code == 0, result.output
    assert "Banco de origem preservado" in result.output
    assert original_column_hashes(destination, original_columns)[1] == before
    assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash

    # Normal development startup invokes the same seed and must retain imported data.
    restarted = create_app({**config, "AUTO_INIT_DB": True})
    assert original_column_hashes(destination, original_columns)[1] == before
    with restarted.app_context():
        assert verify_password(
            "legado123", db.session.get(User, "legacy-user").password_hash
        )
        assert db.session.execute(db.text("PRAGMA foreign_key_check")).first() is None
        db.session.remove()
        db.engine.dispose()
