"""Only bundled synthetic identities and centres may be public in demo mode."""
import json
from pathlib import Path
from alembic import op
from sqlalchemy import text

revision='019'
down_revision='018'
branch_labels=None
depends_on=None

def upgrade():
    data=json.loads((Path(__file__).resolve().parents[3]/'database/seed_data/demo.json').read_text(encoding='utf-8'))['data']
    c=op.get_bind()
    c.execute(text('UPDATE centres SET is_demo=false'))
    for centre in data['centers']:
        c.execute(text("UPDATE centres SET is_demo=true WHERE id=:id AND payload->'name'=CAST(:name AS jsonb)"),{'id':centre['id'],'name':json.dumps(centre['name'],ensure_ascii=False)})
    # Migration 018's inherited IDs alone are insufficient to classify an identity.
    c.execute(text('UPDATE employees SET is_demo_identity=false'))
    for employee in data['professionals']:
        c.execute(text("UPDATE employees SET is_demo_identity=true WHERE id=:id AND payload->'name'=CAST(:name AS jsonb)"),{'id':employee['id'],'name':json.dumps(employee['name'],ensure_ascii=False)})

def downgrade():
    raise RuntimeError('Preserve explicit registry classification; use a reviewed migration')
