"""Source consistency and centre-scoped partner catalogue."""
from alembic import op
revision='005'
down_revision='004'
branch_labels=None
depends_on=None
def upgrade():
    op.get_bind().connection.driver_connection.execute('''
      ALTER TABLE document_chunks ADD CONSTRAINT one_chunk_source CHECK((document_version_id IS NOT NULL)<>(knowledge_id IS NOT NULL));
      CREATE FUNCTION authz.check_document_parent() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
       BEGIN IF NOT EXISTS(SELECT 1 FROM public.documents d WHERE d.id=NEW.document_id AND d.case_id IS NOT DISTINCT FROM NEW.case_id) THEN RAISE EXCEPTION 'VERSION_SOURCE_MISMATCH' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER document_parent BEFORE INSERT OR UPDATE ON document_versions FOR EACH ROW EXECUTE FUNCTION authz.check_document_parent();
      CREATE FUNCTION authz.check_chunk_source() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
       BEGIN
       IF NEW.document_version_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.document_versions v JOIN public.documents d ON d.id=v.document_id WHERE v.id=NEW.document_version_id AND d.id=NEW.document_id AND v.version=NEW.source_version AND d.case_id IS NOT DISTINCT FROM NEW.case_id AND d.centre_id IS NOT DISTINCT FROM NEW.centre_id AND d.category=NEW.category AND d.sensitivity=NEW.sensitivity) THEN RAISE EXCEPTION 'CHUNK_SOURCE_MISMATCH' USING ERRCODE='23514'; END IF;
       IF NEW.knowledge_id IS NOT NULL AND (NEW.document_id IS NOT NULL OR NEW.case_id IS NOT NULL) THEN RAISE EXCEPTION 'KNOWLEDGE_SOURCE_MISMATCH' USING ERRCODE='23514'; END IF;
       RETURN NEW; END $$;
      CREATE TRIGGER chunk_source BEFORE INSERT OR UPDATE ON document_chunks FOR EACH ROW EXECUTE FUNCTION authz.check_chunk_source();
      DROP POLICY chunks_read ON document_chunks;
      CREATE POLICY chunks_read ON document_chunks FOR SELECT TO masar_app USING((document_id IS NOT NULL AND authz.document_allowed(document_id)) OR (knowledge_id IS NOT NULL AND EXISTS(SELECT 1 FROM knowledge_items k WHERE k.id=knowledge_id AND k.version=document_chunks.source_version)));
      CREATE TABLE partner_structures(id text PRIMARY KEY,centre_id text NOT NULL REFERENCES centres,payload jsonb NOT NULL,approval_status text NOT NULL DEFAULT 'DEMO_APPROVED');
      ALTER TABLE partner_structures ENABLE ROW LEVEL SECURITY;
      ALTER TABLE partner_structures FORCE ROW LEVEL SECURITY;
      CREATE POLICY partner_read ON partner_structures FOR SELECT TO masar_app USING(authz.in_centre(centre_id) AND authz.capability('knowledge.read') AND approval_status IN ('APPROVED','DEMO_APPROVED'));
      GRANT SELECT ON partner_structures TO masar_app;
    ''')
def downgrade():raise RuntimeError('Use explicit backup restore')
