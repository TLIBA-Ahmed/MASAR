"""Immutable initial schema and assignment-aware RLS baseline."""
from pathlib import Path
from alembic import op

revision = '001_foundation'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    root = Path(__file__).resolve().parents[2] / 'schema'
    for file in ('001_core.sql', '002_authorization.sql'):
        # psycopg executes the fixed migration as a single SQL script, without parameters.
        op.get_bind().connection.driver_connection.execute((root / file).read_text(encoding='utf-8'))


def downgrade():
    raise RuntimeError('Destructive downgrade intentionally unavailable; restore a verified backup.')
