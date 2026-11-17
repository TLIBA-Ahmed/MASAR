"""Controlled enrollment operation and session revalidation."""
from alembic import op
revision='004'
down_revision='003'
branch_labels=None
depends_on=None
def upgrade():
    op.get_bind().connection.driver_connection.execute('''
      CREATE FUNCTION authz.session_active(session_key uuid,employee_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
       SELECT authz.active_employee() AND employee_key=authz.employee_id() AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_key AND s.employee_id=employee_key AND s.revoked_at IS NULL AND s.expires_at>now());
      $$;
      CREATE FUNCTION authz.enroll_member(group_key text,case_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
       DECLARE new_id uuid; BEGIN
       IF NOT authz.capability('assignments.manage') OR NOT authz.group_allowed(group_key) OR NOT EXISTS(SELECT 1 FROM public.child_groups g JOIN public.cases c ON c.centre_id=g.centre_id WHERE g.id=group_key AND c.id=case_key AND c.payload->>'status'='active') THEN RAISE EXCEPTION 'MEMBERSHIP_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
       INSERT INTO public.child_group_memberships(group_id,case_id,membership_status,added_by) VALUES(group_key,case_key,'ACTIVE',authz.employee_id()) RETURNING id INTO new_id;
       RETURN new_id;
       END $$;
      REVOKE ALL ON FUNCTION authz.enroll_member(text,text),authz.session_active(uuid,text) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION authz.enroll_member(text,text),authz.session_active(uuid,text) TO masar_app;
    ''')
def downgrade():raise RuntimeError('Use explicit backup restore')
