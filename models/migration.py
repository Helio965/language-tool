"""Migração Alembic real e importação verificável sem alterar o banco de origem."""

import json
import sqlite3
from pathlib import Path
import click
from alembic import command
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from extensions import db

ROOT = Path(__file__).resolve().parents[1]
JSON_COLUMNS = {
    "learning_profiles": ("interest_areas", "difficulties"),
    "lessons": ("content",),
    "exercises": ("options", "accepted_answers"),
    "vocabulary": ("examples",),
    "conversations": ("context", "corrected_skills"),
    "messages": ("corrections", "deferred_corrections", "notices"),
}
REQUIRED_FOREIGN_KEYS = {
    "password_reset_tokens": {("user_id", "users", "id", "CASCADE")},
    "learning_profiles": {("user_id", "users", "id", "CASCADE")},
    "preferences": {("user_id", "users", "id", "CASCADE")},
    "exercises": {("lesson_id", "lessons", "id", "CASCADE")},
    "lesson_vocabulary": {
        ("lesson_id", "lessons", "id", "CASCADE"),
        ("vocabulary_id", "vocabulary", "id", "CASCADE"),
    },
    "exercise_attempts": {
        ("user_id", "users", "id", "CASCADE"),
        ("lesson_id", "lessons", "id", "SET NULL"),
    },
    "user_vocabulary": {
        ("user_id", "users", "id", "CASCADE"),
        ("vocabulary_id", "vocabulary", "id", "CASCADE"),
    },
    "progress": {
        ("user_id", "users", "id", "CASCADE"),
        ("lesson_id", "lessons", "id", "CASCADE"),
    },
    "reviews": {("user_id", "users", "id", "CASCADE")},
    "conversations": {("user_id", "users", "id", "CASCADE")},
    "messages": {("conversation_id", "conversations", "id", "CASCADE")},
}


def validate_legacy_connection(connection, expected_columns):
    """Recusa esquemas incompletos e dados corrompidos antes de qualquer alteração."""
    inspector = inspect(connection)
    tables = set(inspector.get_table_names())
    missing = set(expected_columns) - tables
    if missing:
        raise RuntimeError(
            "Banco legado incompleto; faltam tabelas: " + ", ".join(sorted(missing))
        )
    for table, required in expected_columns.items():
        columns = {column["name"] for column in inspector.get_columns(table)}
        absent = set(required) - columns
        if table == "users":
            absent.discard("session_version")
        if absent:
            raise RuntimeError(
                f"Banco legado incompatível: {table} sem " + ", ".join(sorted(absent))
            )
        primary = inspector.get_pk_constraint(table).get("constrained_columns", [])
        expected_primary = (
            ["user_id", "lesson_id"]
            if table == "progress"
            else (
                ["lesson_id", "vocabulary_id"]
                if table == "lesson_vocabulary"
                else (
                    ["user_id", "vocabulary_id"]
                    if table == "user_vocabulary"
                    else (
                        ["user_id"]
                        if table in {"learning_profiles", "preferences"}
                        else ["id"]
                    )
                )
            )
        )
        if set(primary) != set(expected_primary):
            raise RuntimeError(f"Chave primária incompatível no banco legado: {table}.")
    for table, required in REQUIRED_FOREIGN_KEYS.items():
        actual = set()
        if connection.dialect.name == "sqlite":
            # O parser de reflection SQLAlchemy omite ON DELETE em REFERENCES inline
            # do esquema Node; a evidência autoritativa é o catálogo do próprio SQLite.
            for foreign in connection.exec_driver_sql(
                f'PRAGMA foreign_key_list("{table}")'
            ):
                actual.add((foreign[3], foreign[2], foreign[4], foreign[6].upper()))
        else:
            for foreign in inspector.get_foreign_keys(table):
                for local, remote in zip(
                    foreign["constrained_columns"], foreign["referred_columns"]
                ):
                    actual.add(
                        (
                            local,
                            foreign["referred_table"],
                            remote,
                            foreign.get("options", {}).get("ondelete", "").upper(),
                        )
                    )
        if not required <= actual:
            raise RuntimeError(
                f"Relacionamentos ou regras de exclusão incompatíveis: {table}."
            )
    for table, column in (("users", "email"), ("password_reset_tokens", "token_hash")):
        unique = inspector.get_unique_constraints(table) + inspector.get_indexes(table)
        if not any(
            key["column_names"] == [column] and key.get("unique", True)
            for key in unique
        ):
            raise RuntimeError(f"Restrição de unicidade ausente: {table}.{column}.")
    if connection.dialect.name == "sqlite":
        if connection.exec_driver_sql("PRAGMA integrity_check").scalar() != "ok":
            raise RuntimeError("Banco legado falhou na verificação de integridade.")
        if connection.exec_driver_sql("PRAGMA foreign_key_check").first():
            raise RuntimeError("Banco legado contém referências órfãs.")
    for table, columns in JSON_COLUMNS.items():
        for column in columns:
            rows = connection.execute(
                text(f'SELECT "{column}" FROM "{table}"')
            ).scalars()
            for value in rows:
                try:
                    parsed = json.loads(value) if isinstance(value, str) else value
                except (TypeError, ValueError):
                    raise RuntimeError(
                        f"JSON inválido no banco legado: {table}.{column}."
                    ) from None
                expected_type = (
                    dict
                    if (table, column)
                    in {("lessons", "content"), ("conversations", "context")}
                    else list
                )
                if not isinstance(parsed, expected_type):
                    raise RuntimeError(
                        f"JSON incompatível no banco legado: {table}.{column}."
                    )


def initialize_database(app):
    url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
    if (
        url.drivername.startswith("sqlite")
        and url.database
        and url.database != ":memory:"
    ):
        Path(db.engine.url.database).parent.mkdir(parents=True, exist_ok=True)
    configuration = app.extensions["migrate"].migrate.get_config(
        str(ROOT / "migrations")
    )
    command.upgrade(configuration, "head")


def import_legacy(source, destination):
    """Cria uma cópia consistente com backup SQLite; recusa sobrescrever destinos."""
    source = Path(source).resolve()
    destination = Path(destination).resolve()
    if not source.is_file():
        raise ValueError("Banco de origem não encontrado.")
    if destination.exists():
        raise ValueError(
            "O destino já existe; escolha um arquivo novo para preservar os dados."
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        with sqlite3.connect(source.as_uri() + "?mode=ro", uri=True) as original:
            if original.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                raise ValueError(
                    "Banco de origem falhou na verificação de integridade."
                )
            if original.execute("PRAGMA foreign_key_check").fetchone():
                raise ValueError("Banco de origem contém referências órfãs.")
            with sqlite3.connect(destination) as copy:
                original.backup(copy)
    except Exception:
        if destination.exists():
            destination.unlink()
        raise
    destination.chmod(0o600)
    return destination


def register_migration_cli(app):
    @app.cli.command("import-legacy")
    @click.argument(
        "source", type=click.Path(exists=True, dir_okay=False, path_type=Path)
    )
    def import_command(source):
        """Copy SOURCE into the configured, nonexistent SQLite destination, then migrate."""
        url = db.engine.url
        if (
            not url.drivername.startswith("sqlite")
            or not url.database
            or url.database == ":memory:"
        ):
            raise click.ClickException(
                "A importação exige DATABASE_URL apontando para um arquivo SQLite novo."
            )
        db.session.remove()
        db.engine.dispose()
        try:
            destination = import_legacy(source, url.database)
            initialize_database(app)
            from database.seed import seed_content

            seed_content()
        except Exception as error:
            # Não removemos um destino com migração parcial: permite inspeção e recuperação.
            raise click.ClickException(str(error)) from None
        click.echo(
            f"Cópia validada e migrada: {destination}. Banco de origem preservado."
        )
