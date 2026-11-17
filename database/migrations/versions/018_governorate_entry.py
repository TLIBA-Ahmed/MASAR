"""Reference geography and verified professional entry context; preserves all cases."""
import json
from pathlib import Path
from alembic import op
from sqlalchemy import text

revision='018'
down_revision='017'
branch_labels=None
depends_on=None

def upgrade():
    root=Path(__file__).resolve().parents[3]
    c=op.get_bind()
    c.exec_driver_sql('CREATE TABLE governorates(id text PRIMARY KEY CHECK(id ~ \'^TN-[0-9]{2}$\'), name jsonb NOT NULL)')
    for item in json.loads((root/'config/governorates.json').read_text(encoding='utf-8')):
        c.execute(text('INSERT INTO governorates(id,name) VALUES(:id,CAST(:name AS jsonb))'),{'id':item['id'],'name':json.dumps(item['name'],ensure_ascii=False)})
    c.connection.driver_connection.execute((root/'database/schema/008_governorate_entry.sql').read_text(encoding='utf-8'))

def downgrade():
    raise RuntimeError('Keep verified entry context and registry; use a reviewed forward migration')
