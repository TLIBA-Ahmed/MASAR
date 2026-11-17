"""Restore the general professional forum with server authority and forced RLS."""
from pathlib import Path
from alembic import op

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    path = Path(__file__).resolve().parents[2] / 'schema' / '004_forum.sql'
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding='utf-8'))


def downgrade():
    raise RuntimeError('Use explicit backup restore')
