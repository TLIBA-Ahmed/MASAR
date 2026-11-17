"""Backfill educational template scopes for databases created before template seeding evolved."""
from alembic import op
revision='006'
down_revision='005'
branch_labels=None
depends_on=None
def upgrade():
    op.get_bind().connection.driver_connection.execute('''
      UPDATE recommendation_templates t SET required_scopes=ARRAY(SELECT DISTINCT unnest(t.required_scopes||ARRAY['educational.read']) ORDER BY 1)
       WHERE payload->>'recommendationStrategy' IN ('activities','project','training','resources','support');
    ''')
def downgrade():raise RuntimeError('Use explicit backup restore')
