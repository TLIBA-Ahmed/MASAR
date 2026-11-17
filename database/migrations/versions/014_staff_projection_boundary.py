"""Preserve verified public employee projections without weakening child filtering."""
from pathlib import Path
from alembic import op

revision='014'
down_revision='013'
branch_labels=None
depends_on=None

def upgrade():
    source=(Path(__file__).resolve().parents[2]/'schema'/'005_child_privacy.sql').read_text(encoding='utf-8')
    start=source.index('CREATE FUNCTION privacy.apply(')
    end=source.index('CREATE FUNCTION privacy.project(',start)
    op.get_bind().connection.driver_connection.execute(source[start:end].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))

def downgrade():
    raise RuntimeError('Use an explicit, reviewed migration')
