"""Private general-resource attachments with live Forum and conversation policies."""
from pathlib import Path
from alembic import op

revision='017'
down_revision='016'
branch_labels=None
depends_on=None

def upgrade():
    op.get_bind().connection.driver_connection.execute((Path(__file__).resolve().parents[2]/'schema'/'007_forum_attachments.sql').read_text(encoding='utf-8'))

def downgrade():
    raise RuntimeError('Attachment originals must be preserved; use a reviewed migration')
