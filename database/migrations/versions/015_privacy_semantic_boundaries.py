"""Do not guess ambiguous identities; preserve controlled protocol values."""
from pathlib import Path
from alembic import op

revision='015'
down_revision='014'
branch_labels=None
depends_on=None

def upgrade():
    source=(Path(__file__).resolve().parents[2]/'schema'/'005_child_privacy.sql').read_text(encoding='utf-8')
    start=source.index('CREATE FUNCTION privacy.apply(')
    end=source.index('CREATE FUNCTION authz.child_age(',start)
    op.get_bind().connection.driver_connection.execute(source[start:end].replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'))

def downgrade():
    raise RuntimeError('Privacy boundaries must not be downgraded')
