"""Protected originals and document provenance."""
from alembic import op
revision='003'
down_revision='002'
branch_labels=None
depends_on=None
def upgrade():
    op.get_bind().connection.driver_connection.execute('''
      ALTER TABLE documents ADD COLUMN language text NOT NULL DEFAULT 'ar' CHECK(language IN ('ar','fr'));
      ALTER TABLE documents ADD COLUMN effective_from timestamptz NOT NULL DEFAULT now();
      ALTER TABLE documents ADD COLUMN effective_to timestamptz;
      ALTER TABLE documents ADD COLUMN approved_by text REFERENCES employees;
      ALTER TABLE documents ADD COLUMN approved_at timestamptz;
      CREATE TABLE protected_originals(version_id text PRIMARY KEY REFERENCES document_versions,storage_reference text NOT NULL UNIQUE,sha256 text NOT NULL,content_type text NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
      ALTER TABLE protected_originals ENABLE ROW LEVEL SECURITY;
      ALTER TABLE protected_originals FORCE ROW LEVEL SECURITY;
      CREATE POLICY original_read ON protected_originals FOR SELECT TO masar_app USING(EXISTS(SELECT 1 FROM document_versions v WHERE v.id=version_id));
      CREATE POLICY original_index ON protected_originals FOR ALL TO masar_indexer USING(true) WITH CHECK(true);
      GRANT SELECT,INSERT ON protected_originals TO masar_indexer;
      GRANT SELECT ON protected_originals TO masar_app;
      CREATE POLICY original_insert ON protected_originals FOR INSERT TO masar_app WITH CHECK(EXISTS(SELECT 1 FROM document_versions v WHERE v.id=version_id AND v.author_id=authz.employee_id()));
      GRANT INSERT ON protected_originals TO masar_app;
    ''')
def downgrade():raise RuntimeError('Use explicit backup restore')
