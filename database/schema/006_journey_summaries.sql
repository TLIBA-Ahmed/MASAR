CREATE FUNCTION authz.journey_source_allowed(case_key text,kind text,source_key text,visited text[] DEFAULT ARRAY[]::text[])
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
DECLARE r record; t text; found boolean; upstream text;
BEGIN
 IF NOT authz.case_allowed(case_key) OR cardinality(visited)>24 OR (kind||':'||source_key)=ANY(visited) THEN RETURN false; END IF;
 visited=array_append(visited,kind||':'||source_key);
 IF kind='case' THEN RETURN source_key=case_key;
 ELSIF kind IN ('document_versions','documents') THEN
  IF kind='documents' THEN RETURN EXISTS(SELECT 1 FROM public.documents d WHERE d.id=source_key AND d.case_id=case_key AND authz.document_allowed(d.id)); END IF;
  RETURN EXISTS(SELECT 1 FROM public.document_versions v WHERE v.id=source_key AND v.case_id=case_key AND authz.document_allowed(v.document_id));
 ELSIF kind='child_group_memberships' THEN
  RETURN EXISTS(SELECT 1 FROM public.child_group_memberships m WHERE m.id::text=source_key AND m.case_id=case_key AND authz.group_allowed(m.group_id));
 ELSIF kind='activity_sessions' THEN
  RETURN authz.session_allowed(source_key) AND EXISTS(SELECT 1 FROM public.session_participants p WHERE p.session_id=source_key AND p.case_id=case_key);
 ELSIF kind='interventions' THEN
  RETURN authz.capability('knowledge.read') AND EXISTS(SELECT 1 FROM public.interventions i WHERE i.id=source_key AND i.active AND i.approval_status IN ('APPROVED','DEMO_APPROVED') AND (cardinality(i.required_roles)=0 OR EXISTS(SELECT 1 FROM unnest(i.required_roles) r WHERE authz.has_role(r))));
 END IF;
 IF NOT kind=ANY(ARRAY['observations','professional_notes','initial_assessments','intervention_events','case_status_history','roadmaps','roadmap_versions','roadmap_objectives','planned_interventions','appointments','tasks']) THEN RETURN false; END IF;
 EXECUTE format('SELECT * FROM public.%I WHERE id=$1 AND case_id=$2',kind) INTO r USING source_key,case_key;
 IF r.id IS NULL OR NOT authz.record_allowed(case_key,r.category,r.sensitivity,r.id) THEN RETURN false; END IF;
 FOR upstream IN SELECT DISTINCT s FROM unnest(ARRAY[r.source_id,r.payload->>'sourceId']) s WHERE s IS NOT NULL AND s<>'' LOOP
  found=false;
  FOREACH t IN ARRAY ARRAY['case','document_versions','documents','observations','professional_notes','initial_assessments','intervention_events','case_status_history','roadmaps','roadmap_versions','roadmap_objectives','planned_interventions','appointments','tasks','activity_sessions','interventions'] LOOP
   IF authz.journey_source_allowed(case_key,t,upstream,visited) THEN found=true; EXIT; END IF;
  END LOOP;
  IF NOT found THEN RETURN false; END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE FUNCTION authz.summary_sources_allowed(case_key text,refs jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,authz AS $$
 SELECT authz.case_allowed(case_key) AND jsonb_typeof(refs)='array' AND NOT EXISTS(
 SELECT 1 FROM jsonb_array_elements(refs) ref WHERE NOT coalesce(authz.journey_source_allowed(case_key,ref->>'kind',ref->>'id'),false));
$$;
CREATE TABLE journey_stage_summaries(
 id text PRIMARY KEY, case_id text NOT NULL REFERENCES cases(id), stage_id integer NOT NULL CHECK(stage_id BETWEEN 1 AND 5),
 cycle_id integer NOT NULL CHECK(cycle_id>0), summary_ar text NOT NULL,summary_fr text NOT NULL,
 sections jsonb NOT NULL,period jsonb NOT NULL,source_references jsonb NOT NULL CHECK(jsonb_typeof(source_references)='array'),
 context_fingerprint text NOT NULL, generated_at timestamptz NOT NULL DEFAULT now(),
 generation_method text NOT NULL CHECK(generation_method IN ('ai','deterministic_demo','deterministic_unavailable','deterministic_invalid_output','deterministic','manual')),
 model_version text,validation_status text NOT NULL DEFAULT 'draft' CHECK(validation_status IN ('draft','approved','rejected')),
 validated_by text REFERENCES employees(id),validated_at timestamptz,review_reason text,
 version integer NOT NULL CHECK(version>0),created_by text NOT NULL REFERENCES employees(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(case_id,stage_id,cycle_id,version),
 CHECK((validation_status='draft' AND validated_by IS NULL AND validated_at IS NULL) OR (validation_status<>'draft' AND validated_by IS NOT NULL AND validated_at IS NOT NULL AND length(review_reason)>=3))
);
CREATE INDEX journey_summary_history ON journey_stage_summaries(case_id,stage_id,cycle_id,version DESC);
ALTER TABLE journey_stage_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_stage_summaries FORCE ROW LEVEL SECURITY;
CREATE POLICY summary_read ON journey_stage_summaries FOR SELECT USING(authz.summary_sources_allowed(case_id,source_references));
CREATE POLICY summary_create ON journey_stage_summaries FOR INSERT WITH CHECK(
 current_setting('masar.purpose',true)='journey.summary.generate' AND created_by=authz.employee_id()
 AND authz.capability('journey.summary.generate') AND authz.has_scope(case_id,'journey.summary.generate')
 AND validation_status='draft' AND authz.summary_sources_allowed(case_id,source_references));
CREATE POLICY summary_review ON journey_stage_summaries FOR UPDATE USING(
 current_setting('masar.purpose',true)='journey.summary.review' AND authz.capability('journey.summary.review')
 AND authz.has_scope(case_id,'journey.summary.review') AND authz.summary_sources_allowed(case_id,source_references))
 WITH CHECK(validated_by=authz.employee_id() AND authz.summary_sources_allowed(case_id,source_references));
CREATE FUNCTION authz.immutable_journey_summary() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'IMMUTABLE_SUMMARY_HISTORY' USING ERRCODE='23514'; END IF;
 IF OLD.validation_status<>'draft' OR NEW.validation_status NOT IN ('approved','rejected') OR
 (to_jsonb(OLD)-ARRAY['validation_status','validated_by','validated_at','review_reason','updated_at']) IS DISTINCT FROM
 (to_jsonb(NEW)-ARRAY['validation_status','validated_by','validated_at','review_reason','updated_at']) THEN
  RAISE EXCEPTION 'IMMUTABLE_SUMMARY_HISTORY' USING ERRCODE='23514';
 END IF;
 NEW.validated_at=now();NEW.updated_at=now();RETURN NEW;
END $$;
CREATE TRIGGER immutable_journey_summary BEFORE UPDATE OR DELETE ON journey_stage_summaries FOR EACH ROW EXECUTE FUNCTION authz.immutable_journey_summary();
CREATE FUNCTION authz.next_summary_version(case_key text,stage_key integer,cycle_key integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,authz AS $$
DECLARE result integer;
BEGIN
 IF current_setting('masar.purpose',true)<>'journey.summary.generate' OR NOT authz.case_allowed(case_key) OR NOT authz.capability('journey.summary.generate') OR NOT authz.has_scope(case_key,'journey.summary.generate') THEN RAISE EXCEPTION 'SUMMARY_GENERATION_DENIED' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(case_key||':'||stage_key||':'||cycle_key,0));
 SELECT coalesce(max(version),0)+1 INTO result FROM public.journey_stage_summaries WHERE case_id=case_key AND stage_id=stage_key AND cycle_id=cycle_key;
 RETURN result;
END $$;
INSERT INTO role_permissions(role_id,permission) SELECT r.id,p FROM roles r CROSS JOIN unnest(ARRAY['journey.summary.generate','journey.summary.review']) p WHERE r.id IN ('social','educator','psychologist','administration') ON CONFLICT DO NOTHING;
INSERT INTO assignment_scopes(case_assignment_id,scope_code,granted_by)
 SELECT a.id,p,a.assigned_by FROM case_assignments a CROSS JOIN unnest(ARRAY['journey.summary.generate','journey.summary.review']) p
 WHERE EXISTS(SELECT 1 FROM assignment_scopes s WHERE s.case_assignment_id=a.id AND s.scope_code='roadmap.write' AND s.revoked_at IS NULL) ON CONFLICT DO NOTHING;
INSERT INTO group_assignment_scopes(group_assignment_id,scope_code,granted_by)
 SELECT a.id,p,a.assigned_by FROM group_assignments a CROSS JOIN unnest(ARRAY['journey.summary.generate','journey.summary.review']) p
 WHERE EXISTS(SELECT 1 FROM group_assignment_scopes s WHERE s.group_assignment_id=a.id AND s.scope_code='roadmap.write' AND s.revoked_at IS NULL) ON CONFLICT DO NOTHING;
GRANT SELECT,INSERT ON journey_stage_summaries TO masar_app;
GRANT UPDATE(validation_status,validated_by,validated_at,review_reason,updated_at) ON journey_stage_summaries TO masar_app;
REVOKE ALL ON FUNCTION authz.journey_source_allowed(text,text,text,text[]),authz.summary_sources_allowed(text,jsonb),authz.next_summary_version(text,integer,integer),authz.immutable_journey_summary() FROM PUBLIC;
