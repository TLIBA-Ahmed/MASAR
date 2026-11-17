"""Controlled approval metadata; immutable original content stays unchanged."""
from alembic import op
revision='008'
down_revision='007'
branch_labels=None
depends_on=None
def upgrade():
    op.get_bind().connection.driver_connection.execute('''
      CREATE FUNCTION authz.mark_document_approved(document_key text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
       BEGIN
       IF NOT authz.document_allowed(document_key,'write') OR NOT EXISTS(SELECT 1 FROM public.document_versions v WHERE v.document_id=document_key AND v.author_id=authz.employee_id() AND v.status='validated') THEN RAISE EXCEPTION 'DOCUMENT_APPROVAL_DENIED' USING ERRCODE='42501'; END IF;
       UPDATE public.documents SET approval_status='DEMO_APPROVED',approved_by=authz.employee_id(),approved_at=now() WHERE id=document_key;
       END $$;
      REVOKE ALL ON FUNCTION authz.mark_document_approved(text) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION authz.mark_document_approved(text) TO masar_app;
    ''')
def downgrade():raise RuntimeError('Use explicit backup restore')
