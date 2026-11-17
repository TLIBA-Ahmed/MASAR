"""Immutable, authorized journey synthesis snapshots and explicit professional review."""
from pathlib import Path
from alembic import op

revision='011'
down_revision='010'
branch_labels=None
depends_on=None

def upgrade():
    op.get_bind().connection.driver_connection.execute((Path(__file__).resolve().parents[2]/'schema'/'006_journey_summaries.sql').read_text(encoding='utf-8'))

def downgrade():
    raise RuntimeError('Summary history requires an explicit backup restore')
