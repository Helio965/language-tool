"""Alembic usa a conexão da application factory, incluindo bancos em memória."""

from alembic import context
from flask import current_app

config = context.config
# The hosting application owns logging. Reconfiguring root handlers here would
# disable its safe error logs every time automatic migrations run.
database = current_app.extensions["migrate"].db
target_metadata = database.metadata

if context.is_offline_mode():
    context.configure(
        url=str(database.engine.url),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()
else:
    with database.engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=connection.dialect.name == "sqlite",
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()
