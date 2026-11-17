CREATE TABLE forum_posts (
 id text PRIMARY KEY,
 centre_id text NOT NULL REFERENCES centres,
 author_id text NOT NULL REFERENCES employees,
 payload jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE forum_favorites (
 post_id text NOT NULL REFERENCES forum_posts,
 employee_id text NOT NULL REFERENCES employees,
 active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(post_id,employee_id)
);
CREATE TABLE forum_conversations (
 id text PRIMARY KEY,
 centre_id text NOT NULL REFERENCES centres,
 members text[] NOT NULL CHECK(cardinality(members)>0),
 payload jsonb NOT NULL
);

CREATE OR REPLACE FUNCTION authz.valid_purpose() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('masar.purpose',true),'') IN ('identity','case.read','case.write','group.read','group.manage','forms.read','forms.write','browser.read','recommendation.generate','feedback.write','roadmap.write','catalogue.read','catalogue.write','audit.read','forum.read','forum.write');
$$;

-- General knowledge only: a live centre assignment with general.read is required.
-- No case identifiers, private documents or AI retrieval enter these tables.
CREATE FUNCTION authz.forum_allowed(centre text, operation text DEFAULT 'read') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT operation IN ('read','write')
 AND current_setting('masar.purpose',true) IN ('forum.read','forum.write')
 AND (operation='read' OR current_setting('masar.purpose',true)='forum.write')
 AND authz.capability('forum.read') AND authz.capability('forum.'||operation) AND authz.in_centre(centre)
 AND (
  EXISTS(SELECT 1 FROM public.group_assignments a
   JOIN public.child_groups g ON g.id=a.group_id
   JOIN public.group_assignment_scopes s ON s.group_assignment_id=a.id
   JOIN public.employee_roles r ON r.employee_id=a.employee_id AND r.role_id=a.role_id
   WHERE a.employee_id=authz.employee_id() AND g.centre_id=centre AND g.status='ACTIVE'
    AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())
    AND s.scope_code='general.read' AND s.revoked_at IS NULL)
  OR EXISTS(SELECT 1 FROM public.case_assignments a
   JOIN public.cases c ON c.id=a.case_id
   JOIN public.assignment_scopes s ON s.case_assignment_id=a.id
   JOIN public.employee_roles r ON r.employee_id=a.employee_id AND r.role_id=a.role_id
   WHERE a.employee_id=authz.employee_id() AND c.centre_id=centre
    AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now())
    AND s.scope_code='general.read' AND s.revoked_at IS NULL)
 );
$$;
REVOKE ALL ON FUNCTION authz.forum_allowed(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION authz.forum_allowed(text,text) TO masar_app;

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE forum_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_favorites FORCE ROW LEVEL SECURITY;
ALTER TABLE forum_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_conversations FORCE ROW LEVEL SECURITY;

CREATE POLICY forum_posts_read ON forum_posts FOR SELECT USING(authz.forum_allowed(centre_id));
CREATE POLICY forum_posts_create ON forum_posts FOR INSERT WITH CHECK(author_id=authz.employee_id() AND authz.forum_allowed(centre_id,'write'));
CREATE POLICY forum_posts_update ON forum_posts FOR UPDATE USING(authz.forum_allowed(centre_id,'write')) WITH CHECK(authz.forum_allowed(centre_id,'write'));
CREATE POLICY forum_favorites_read ON forum_favorites FOR SELECT USING(employee_id=authz.employee_id() AND EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=post_id));
CREATE POLICY forum_favorites_create ON forum_favorites FOR INSERT WITH CHECK(employee_id=authz.employee_id() AND EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=post_id AND authz.forum_allowed(p.centre_id,'write')));
CREATE POLICY forum_favorites_update ON forum_favorites FOR UPDATE USING(employee_id=authz.employee_id() AND EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=post_id AND authz.forum_allowed(p.centre_id,'write'))) WITH CHECK(employee_id=authz.employee_id() AND EXISTS(SELECT 1 FROM forum_posts p WHERE p.id=post_id AND authz.forum_allowed(p.centre_id,'write')));
CREATE POLICY forum_conversations_read ON forum_conversations FOR SELECT USING(authz.employee_id()=ANY(members) AND authz.forum_allowed(centre_id));
CREATE POLICY forum_conversations_update ON forum_conversations FOR UPDATE USING(authz.employee_id()=ANY(members) AND authz.forum_allowed(centre_id,'write')) WITH CHECK(authz.employee_id()=ANY(members) AND authz.forum_allowed(centre_id,'write'));

GRANT SELECT,INSERT ON forum_posts TO masar_app;
GRANT UPDATE(payload) ON forum_posts TO masar_app;
GRANT SELECT,INSERT ON forum_favorites TO masar_app;
GRANT UPDATE(active) ON forum_favorites TO masar_app;
GRANT SELECT ON forum_conversations TO masar_app;
GRANT UPDATE(payload) ON forum_conversations TO masar_app;

-- Configurable demonstration permissions, not an institutional sharing policy.
INSERT INTO role_permissions(role_id,permission)
 SELECT r.id,p.code FROM roles r CROSS JOIN (VALUES ('forum.read'),('forum.write')) p(code)
 WHERE r.id IN ('social','psychologist','educator','administration') ON CONFLICT DO NOTHING;
