from alembic import context
from backend.db import engine


def run_migrations():
    with engine('admin').connect() as connection:
        context.configure(connection=connection, transaction_per_migration=True)
        with context.begin_transaction():
            context.run_migrations()


run_migrations()
