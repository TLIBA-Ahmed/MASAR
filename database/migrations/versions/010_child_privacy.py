"""Permanent child codes, isolated identity and privacy projections (additive)."""
from pathlib import Path
from alembic import op

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    op.get_bind().connection.driver_connection.execute(
        (Path(__file__).resolve().parents[2] / 'schema' / '005_child_privacy.sql').read_text(encoding='utf-8'))


def downgrade():
    raise RuntimeError('Protected identities and permanent codes require an explicit backup restore')
