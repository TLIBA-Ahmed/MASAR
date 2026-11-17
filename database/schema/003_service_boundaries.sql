ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_publish ON outbox_events FOR INSERT TO masar_app WITH CHECK(employee_id=authz.employee_id() AND authz.active_employee());
CREATE POLICY outbox_worker_read ON outbox_events FOR SELECT TO masar_indexer USING(true);
CREATE POLICY outbox_worker_update ON outbox_events FOR UPDATE TO masar_indexer USING(true) WITH CHECK(true);
CREATE POLICY index_documents ON documents FOR SELECT TO masar_indexer USING(true);
CREATE POLICY index_versions ON document_versions FOR SELECT TO masar_indexer USING(true);
CREATE POLICY index_knowledge ON knowledge_items FOR SELECT TO masar_indexer USING(true);
CREATE POLICY index_catalogue ON interventions FOR SELECT TO masar_indexer USING(true);
CREATE POLICY index_chunks ON document_chunks FOR ALL TO masar_indexer USING(true) WITH CHECK(true);
ALTER TABLE assessment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_items FORCE ROW LEVEL SECURITY;
CREATE POLICY assessment_item_read ON assessment_items FOR SELECT USING(EXISTS(SELECT 1 FROM initial_assessments a WHERE a.id=assessment_id));
CREATE FUNCTION authz.document_metadata() RETURNS TABLE(id text,case_id text,title jsonb,category text,approval_status text,versions bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT d.id,d.case_id,d.title,d.category,d.approval_status,(SELECT count(*) FROM public.document_versions v WHERE v.document_id=d.id)
 FROM public.documents d WHERE authz.case_allowed(d.case_id) AND authz.has_scope(d.case_id,'documents.metadata');
$$;
REVOKE ALL ON FUNCTION authz.document_metadata() FROM PUBLIC;
CREATE SEQUENCE case_number START 41;
GRANT USAGE ON SEQUENCE case_number TO masar_app;
CREATE POLICY case_scope_create ON assignment_scopes FOR INSERT WITH CHECK(EXISTS(SELECT 1 FROM case_assignments a WHERE a.id=case_assignment_id AND a.employee_id=authz.employee_id()) AND authz.capability('cases.create'));
CREATE POLICY own_case_assignment ON case_assignments FOR INSERT WITH CHECK(employee_id=authz.employee_id() AND assigned_by=authz.employee_id() AND authz.capability('cases.create') AND role_id='social');
CREATE POLICY sessions_update ON activity_sessions FOR UPDATE USING(author_id=authz.employee_id() AND authz.session_allowed(id) AND authz.capability('interventions.plan')) WITH CHECK(author_id=authz.employee_id() AND authz.session_allowed(id));
CREATE POLICY participants_update ON session_participants FOR UPDATE USING(authz.session_allowed(session_id) AND authz.case_allowed(case_id,'educational','write')) WITH CHECK(authz.session_allowed(session_id) AND authz.case_allowed(case_id,'educational','write'));
UPDATE recommendation_templates SET required_scopes=required_scopes||ARRAY['educational.read'] WHERE id IN ('workshops','educational-project','training-project','educational-resources','validated-support');
