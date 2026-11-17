"""Service principals, metadata projection, transactional outbox boundaries."""
from alembic import op
from pathlib import Path
revision='002'
down_revision='001_foundation'
branch_labels=None
depends_on=None

def upgrade():
    path=Path(__file__).resolve().parents[2]/'schema'/'003_service_boundaries.sql'
    op.get_bind().connection.driver_connection.execute(path.read_text(encoding='utf-8'))

def downgrade():
    raise RuntimeError('Restore an explicit backup; automatic destructive downgrade is disabled')
