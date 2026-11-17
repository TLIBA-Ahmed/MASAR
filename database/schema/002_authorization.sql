CREATE FUNCTION authz.employee_id() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('masar.employee_id',true),'') $$;
CREATE FUNCTION authz.valid_purpose() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('masar.purpose',true),'') IN ('identity','case.read','case.write','group.read','group.manage','forms.read','forms.write','browser.read','recommendation.generate','feedback.write','roadmap.write','catalogue.read','catalogue.write','audit.read');
$$;
CREATE FUNCTION authz.active_employee() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$ SELECT authz.valid_purpose() AND EXISTS(SELECT 1 FROM public.employees e WHERE e.id=authz.employee_id() AND e.active) $$;
CREATE FUNCTION authz.has_role(role_code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$ SELECT authz.active_employee() AND EXISTS(SELECT 1 FROM public.employee_roles r WHERE r.employee_id=authz.employee_id() AND r.role_id=role_code) $$;
CREATE FUNCTION authz.capability(code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT authz.active_employee() AND EXISTS(SELECT 1 FROM public.employee_roles er JOIN public.role_permissions rp ON rp.role_id=er.role_id WHERE er.employee_id=authz.employee_id() AND rp.permission=code);
$$;
CREATE FUNCTION authz.in_centre(centre text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$ SELECT authz.active_employee() AND EXISTS(SELECT 1 FROM public.employee_centres ec WHERE ec.employee_id=authz.employee_id() AND ec.centre_id=centre AND ec.active) $$;
CREATE FUNCTION authz.group_allowed(group_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT EXISTS(SELECT 1 FROM public.child_groups g JOIN public.group_assignments ga ON ga.group_id=g.id JOIN public.employee_roles er ON er.employee_id=ga.employee_id AND er.role_id=ga.role_id WHERE g.id=group_key AND g.status='ACTIVE' AND authz.in_centre(g.centre_id) AND ga.employee_id=authz.employee_id() AND ga.assignment_status='ACTIVE' AND ga.valid_from<=now() AND (ga.valid_to IS NULL OR ga.valid_to>now()));
$$;
CREATE FUNCTION authz.has_scope(case_key text, code text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT EXISTS(SELECT 1 FROM public.case_assignments a JOIN public.assignment_scopes s ON s.case_assignment_id=a.id JOIN public.employee_roles er ON er.employee_id=a.employee_id AND er.role_id=a.role_id WHERE a.case_id=case_key AND a.employee_id=authz.employee_id() AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()) AND s.scope_code=code AND s.revoked_at IS NULL)
 OR EXISTS(SELECT 1 FROM public.child_group_memberships m JOIN public.child_groups g ON g.id=m.group_id JOIN public.group_assignments a ON a.group_id=m.group_id JOIN public.group_assignment_scopes s ON s.group_assignment_id=a.id JOIN public.employee_roles er ON er.employee_id=a.employee_id AND er.role_id=a.role_id WHERE m.case_id=case_key AND m.membership_status='ACTIVE' AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now()) AND g.status='ACTIVE' AND a.employee_id=authz.employee_id() AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()) AND s.scope_code=code AND s.revoked_at IS NULL);
$$;
CREATE FUNCTION authz.case_allowed(case_key text, category_key text DEFAULT 'general', operation text DEFAULT 'read') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT authz.capability(category_key||'.'||operation) AND EXISTS(SELECT 1 FROM public.cases c WHERE c.id=case_key AND authz.in_centre(c.centre_id)) AND authz.has_scope(case_key,category_key||'.'||operation);
$$;
CREATE FUNCTION authz.record_allowed(case_key text, category_key text, sensitivity_level integer, resource_key text, operation text DEFAULT 'read') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT authz.case_allowed(case_key,'general','read') AND authz.capability(category_key||'.'||operation)
 AND (authz.case_allowed(case_key,category_key,operation) OR EXISTS(SELECT 1 FROM public.record_grants r WHERE r.employee_id=authz.employee_id() AND r.case_id=case_key AND r.resource_id=resource_key AND r.category=category_key AND r.action=operation AND r.revoked_at IS NULL AND (r.valid_until IS NULL OR r.valid_until>now())))
 AND (sensitivity_level<2 OR authz.has_scope(case_key,'confidential.'||operation) OR EXISTS(SELECT 1 FROM public.record_grants r WHERE r.employee_id=authz.employee_id() AND r.resource_id=resource_key AND r.case_id=case_key AND r.category=category_key AND r.action=operation AND r.revoked_at IS NULL AND (r.valid_until IS NULL OR r.valid_until>now())));
$$;
CREATE FUNCTION authz.document_allowed(document_key text, operation text DEFAULT 'read') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT EXISTS(SELECT 1 FROM public.documents d WHERE d.id=document_key AND ((d.case_id IS NOT NULL AND authz.record_allowed(d.case_id,d.category,d.sensitivity,d.id,operation)) OR (d.case_id IS NULL AND authz.active_employee() AND (d.centre_id IS NULL OR authz.in_centre(d.centre_id)) AND d.approval_status IN ('APPROVED','DEMO_APPROVED') AND authz.capability('knowledge.'||operation))));
$$;
CREATE FUNCTION authz.session_allowed(session_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT authz.active_employee() AND EXISTS(SELECT 1 FROM public.session_participants p WHERE p.session_id=session_key) AND NOT EXISTS(SELECT 1 FROM public.session_participants p WHERE p.session_id=session_key AND NOT authz.case_allowed(p.case_id,'educational','read'));
$$;
CREATE FUNCTION authz.run_allowed(run_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$ SELECT EXISTS(SELECT 1 FROM public.recommendation_runs r WHERE r.id=run_key AND r.employee_id=authz.employee_id() AND authz.case_allowed(r.case_id,'general','read')) $$;

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['children','cases','case_profiles','case_status_history','case_transfers','observations','initial_assessments','professional_notes','roadmaps','roadmap_versions','roadmap_objectives','planned_interventions','intervention_events','appointments','tasks','child_groups','child_group_memberships','group_assignments','group_assignment_scopes','case_assignments','assignment_scopes','record_grants','documents','document_versions','document_chunks','activity_sessions','session_participants','recommendation_runs','recommendation_candidates','recommendation_feedback','audit_events','access_review_events','sessions'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['case_profiles','case_status_history','case_transfers','observations','initial_assessments','professional_notes','roadmaps','roadmap_versions','roadmap_objectives','planned_interventions','intervention_events','appointments','tasks'] LOOP
  EXECUTE format('CREATE POLICY record_read ON %I FOR SELECT USING(authz.record_allowed(case_id,category,sensitivity,id))',tab);
  EXECUTE format('CREATE POLICY record_insert ON %I FOR INSERT WITH CHECK(author_id=authz.employee_id() AND authz.record_allowed(case_id,category,sensitivity,id,''write''))',tab);
  EXECUTE format('CREATE POLICY record_update ON %I FOR UPDATE USING(authz.record_allowed(case_id,category,sensitivity,id,''write'')) WITH CHECK(author_id=authz.employee_id() AND authz.record_allowed(case_id,category,sensitivity,id,''write''))',tab);
 END LOOP;
END $$;
CREATE POLICY case_read ON cases FOR SELECT USING(authz.case_allowed(id));
CREATE POLICY case_insert ON cases FOR INSERT WITH CHECK(authz.capability('cases.create') AND authz.in_centre(centre_id));
CREATE POLICY case_update ON cases FOR UPDATE USING(authz.case_allowed(id,'general','write')) WITH CHECK(authz.case_allowed(id,'general','write'));
CREATE POLICY child_read ON children FOR SELECT USING(EXISTS(SELECT 1 FROM cases c WHERE c.child_id=children.id));
CREATE POLICY child_insert ON children FOR INSERT WITH CHECK(authz.capability('cases.create'));
CREATE POLICY child_update ON children FOR UPDATE USING(EXISTS(SELECT 1 FROM cases c WHERE c.child_id=children.id AND authz.case_allowed(c.id,'general','write'))) WITH CHECK(EXISTS(SELECT 1 FROM cases c WHERE c.child_id=children.id AND authz.case_allowed(c.id,'general','write')));
CREATE POLICY group_read ON child_groups FOR SELECT USING(authz.group_allowed(id) OR (authz.capability('groups.manage') AND authz.in_centre(centre_id)));
CREATE POLICY group_manage ON child_groups FOR ALL USING(authz.capability('groups.manage') AND authz.in_centre(centre_id)) WITH CHECK(authz.capability('groups.manage') AND authz.in_centre(centre_id));
CREATE POLICY membership_read ON child_group_memberships FOR SELECT USING(authz.group_allowed(group_id) AND authz.case_allowed(case_id));
CREATE POLICY membership_manage ON child_group_memberships FOR ALL USING(authz.capability('assignments.manage') AND EXISTS(SELECT 1 FROM child_groups g JOIN cases c ON c.id=case_id WHERE g.id=group_id AND g.centre_id=c.centre_id AND authz.in_centre(g.centre_id))) WITH CHECK(authz.capability('assignments.manage') AND EXISTS(SELECT 1 FROM child_groups g JOIN cases c ON c.id=case_id WHERE g.id=group_id AND g.centre_id=c.centre_id AND authz.in_centre(g.centre_id)));
CREATE POLICY group_assignment_read ON group_assignments FOR SELECT USING(employee_id=authz.employee_id() OR (authz.capability('assignments.manage') AND EXISTS(SELECT 1 FROM child_groups g WHERE g.id=group_id AND authz.in_centre(g.centre_id))));
CREATE POLICY group_assignment_manage ON group_assignments FOR ALL USING(authz.capability('assignments.manage') AND EXISTS(SELECT 1 FROM child_groups g WHERE g.id=group_id AND authz.in_centre(g.centre_id))) WITH CHECK(authz.capability('assignments.manage') AND EXISTS(SELECT 1 FROM child_groups g WHERE g.id=group_id AND authz.in_centre(g.centre_id)));
CREATE POLICY case_assignment_read ON case_assignments FOR SELECT USING(employee_id=authz.employee_id() OR (authz.capability('assignments.manage') AND authz.case_allowed(case_id)));
CREATE POLICY case_assignment_manage ON case_assignments FOR ALL USING(authz.capability('assignments.manage') AND authz.case_allowed(case_id)) WITH CHECK(authz.capability('assignments.manage') AND authz.case_allowed(case_id));
CREATE POLICY group_scopes ON group_assignment_scopes FOR SELECT USING(EXISTS(SELECT 1 FROM group_assignments a WHERE a.id=group_assignment_id));
CREATE POLICY case_scopes ON assignment_scopes FOR SELECT USING(EXISTS(SELECT 1 FROM case_assignments a WHERE a.id=case_assignment_id));
CREATE POLICY grant_read ON record_grants FOR SELECT USING(employee_id=authz.employee_id() AND authz.case_allowed(case_id));
CREATE POLICY document_read ON documents FOR SELECT USING(authz.document_allowed(id));
CREATE POLICY document_insert ON documents FOR INSERT WITH CHECK(created_by=authz.employee_id() AND authz.record_allowed(case_id,category,sensitivity,id,'write'));
CREATE POLICY version_read ON document_versions FOR SELECT USING(authz.document_allowed(document_id));
CREATE POLICY version_insert ON document_versions FOR INSERT WITH CHECK(author_id=authz.employee_id() AND authz.document_allowed(document_id,'write'));
CREATE POLICY version_update ON document_versions FOR UPDATE USING(author_id=authz.employee_id() AND authz.document_allowed(document_id,'write')) WITH CHECK(author_id=authz.employee_id() AND authz.document_allowed(document_id,'write'));
CREATE POLICY chunks_read ON document_chunks FOR SELECT USING((document_id IS NOT NULL AND authz.document_allowed(document_id)) OR (knowledge_id IS NOT NULL AND EXISTS(SELECT 1 FROM knowledge_items k WHERE k.id=knowledge_id AND k.approval_status IN ('APPROVED','DEMO_APPROVED') AND (k.centre_id IS NULL OR authz.in_centre(k.centre_id)) AND (cardinality(k.required_roles)=0 OR EXISTS(SELECT 1 FROM unnest(k.required_roles) r WHERE authz.has_role(r))))));
CREATE POLICY sessions_read ON activity_sessions FOR SELECT USING(authz.session_allowed(id));
CREATE POLICY sessions_insert ON activity_sessions FOR INSERT WITH CHECK(author_id=authz.employee_id() AND authz.in_centre(centre_id) AND authz.capability('interventions.plan'));
CREATE POLICY participants_read ON session_participants FOR SELECT USING(authz.session_allowed(session_id));
CREATE POLICY participants_insert ON session_participants FOR INSERT WITH CHECK(authz.case_allowed(case_id,'educational','write') AND authz.capability('interventions.plan'));
CREATE POLICY runs_read ON recommendation_runs FOR SELECT USING(authz.run_allowed(id));
CREATE POLICY runs_insert ON recommendation_runs FOR INSERT WITH CHECK(employee_id=authz.employee_id() AND authz.case_allowed(case_id));
CREATE POLICY candidates_read ON recommendation_candidates FOR SELECT USING(authz.run_allowed(run_id));
CREATE POLICY candidates_insert ON recommendation_candidates FOR INSERT WITH CHECK(authz.run_allowed(run_id));
CREATE POLICY feedback_read ON recommendation_feedback FOR SELECT USING(employee_id=authz.employee_id() AND EXISTS(SELECT 1 FROM recommendation_candidates c WHERE c.id=candidate_id));
CREATE POLICY feedback_insert ON recommendation_feedback FOR INSERT WITH CHECK(employee_id=authz.employee_id() AND EXISTS(SELECT 1 FROM recommendation_candidates c WHERE c.id=candidate_id));
CREATE POLICY audit_insert ON audit_events FOR INSERT WITH CHECK(employee_id IS NOT DISTINCT FROM authz.employee_id());
CREATE POLICY audit_read ON audit_events FOR SELECT USING(employee_id=authz.employee_id() OR authz.capability('audit.read'));
CREATE POLICY reviews_read ON access_review_events FOR SELECT USING(employee_id=authz.employee_id() OR actor_id=authz.employee_id());
CREATE POLICY reviews_insert ON access_review_events FOR INSERT WITH CHECK(actor_id=authz.employee_id() AND authz.capability('assignments.manage'));
CREATE POLICY sessions_none ON sessions FOR SELECT USING(false);

CREATE FUNCTION authz.resolve_session(hash text) RETURNS TABLE(employee_id text,session_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$ SELECT s.employee_id,s.id FROM public.sessions s JOIN public.employees e ON e.id=s.employee_id AND e.active WHERE s.token_hash=hash AND s.revoked_at IS NULL AND s.expires_at>now() $$;
CREATE FUNCTION authz.create_demo_session(employee_key text,hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 DECLARE new_id uuid; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=employee_key AND active) THEN RAISE EXCEPTION 'UNKNOWN_DEMO_IDENTITY' USING ERRCODE='28000'; END IF;
 INSERT INTO public.sessions(token_hash,employee_id,expires_at) VALUES(hash,employee_key,now()+interval '8 hours') RETURNING id INTO new_id; RETURN new_id;
 END $$;
CREATE FUNCTION authz.revoke_session(hash text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$ UPDATE public.sessions SET revoked_at=now() WHERE token_hash=hash $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA authz FROM PUBLIC;

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions FORCE ROW LEVEL SECURITY;
CREATE POLICY catalogue_read ON interventions FOR SELECT USING(authz.capability('knowledge.read') AND active AND approval_status IN ('DEMO_APPROVED','APPROVED') AND (cardinality(required_roles)=0 OR EXISTS(SELECT 1 FROM unnest(required_roles) r WHERE authz.has_role(r))));
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items FORCE ROW LEVEL SECURITY;
CREATE POLICY knowledge_read ON knowledge_items FOR SELECT USING(authz.capability('knowledge.read') AND approval_status IN ('DEMO_APPROVED','APPROVED') AND (centre_id IS NULL OR authz.in_centre(centre_id)) AND (cardinality(required_roles)=0 OR EXISTS(SELECT 1 FROM unnest(required_roles) r WHERE authz.has_role(r))));
ALTER TABLE recommendation_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_templates FORCE ROW LEVEL SECURITY;
CREATE POLICY template_read ON recommendation_templates FOR SELECT USING(authz.capability('recommendation.use') AND active AND EXISTS(SELECT 1 FROM template_roles t WHERE t.template_id=recommendation_templates.id AND authz.has_role(t.role_id)));

CREATE FUNCTION authz.demo_identities() RETURNS TABLE(id text,payload jsonb) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ SELECT e.id, e.payload FROM public.employees e WHERE active ORDER BY e.id $$;
REVOKE ALL ON FUNCTION authz.demo_identities() FROM PUBLIC;

CREATE FUNCTION authz.check_membership_centre() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.child_groups g JOIN public.cases c ON g.centre_id=c.centre_id WHERE g.id=NEW.group_id AND c.id=NEW.case_id) THEN RAISE EXCEPTION 'CROSS_CENTRE_MEMBERSHIP' USING ERRCODE='23514'; END IF;
 RETURN NEW;
 END $$;
CREATE TRIGGER membership_centre BEFORE INSERT OR UPDATE ON child_group_memberships FOR EACH ROW EXECUTE FUNCTION authz.check_membership_centre();
