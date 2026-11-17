"""Preserve existing explicit family records without implicit sibling access."""
from alembic import op
revision='007'
down_revision='006'
branch_labels=None
depends_on=None
def upgrade():
    op.get_bind().connection.driver_connection.execute('''
      CREATE TABLE families(id text PRIMARY KEY,centre_id text NOT NULL REFERENCES centres,author_id text NOT NULL REFERENCES employees,payload jsonb NOT NULL,version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE case_family_links(case_id text PRIMARY KEY REFERENCES cases,family_id text NOT NULL REFERENCES families,confirmed_by text NOT NULL REFERENCES employees,created_at timestamptz NOT NULL DEFAULT now());
      ALTER TABLE families ENABLE ROW LEVEL SECURITY;ALTER TABLE families FORCE ROW LEVEL SECURITY;
      ALTER TABLE case_family_links ENABLE ROW LEVEL SECURITY;ALTER TABLE case_family_links FORCE ROW LEVEL SECURITY;
      CREATE FUNCTION authz.family_allowed(family_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
       SELECT authz.capability('social.read') AND EXISTS(SELECT 1 FROM public.case_family_links l WHERE l.family_id=family_key AND authz.case_allowed(l.case_id,'social','read')) AND NOT EXISTS(SELECT 1 FROM public.case_family_links l WHERE l.family_id=family_key AND NOT authz.case_allowed(l.case_id,'social','read'));
      $$;
      REVOKE ALL ON FUNCTION authz.family_allowed(text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION authz.family_allowed(text) TO masar_app;
      CREATE POLICY family_read ON families FOR SELECT USING(authz.family_allowed(id));
      CREATE POLICY family_create ON families FOR INSERT WITH CHECK(author_id=authz.employee_id() AND authz.capability('cases.create') AND authz.in_centre(centre_id));
      CREATE POLICY family_link_read ON case_family_links FOR SELECT USING(authz.case_allowed(case_id,'social','read'));
      CREATE POLICY family_link_create ON case_family_links FOR INSERT WITH CHECK(confirmed_by=authz.employee_id() AND authz.case_allowed(case_id,'social','write'));
      GRANT SELECT,INSERT ON families,case_family_links TO masar_app;
    ''')
def downgrade():raise RuntimeError('Use explicit backup restore')
