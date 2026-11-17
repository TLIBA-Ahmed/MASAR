CREATE SCHEMA privacy;
REVOKE ALL ON SCHEMA privacy FROM PUBLIC;
CREATE FUNCTION privacy.new_child_code() RETURNS text LANGUAGE sql VOLATILE
SET search_path=pg_catalog,public AS $$ SELECT 'CH-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,24)) $$;
ALTER TABLE children ADD COLUMN child_code text;
-- Preserve the familiar synthetic demo references. All subsequent identities use random codes.
UPDATE children ch SET child_code=coalesce((SELECT min(c.id) FROM cases c WHERE c.child_id=ch.id),privacy.new_child_code());
ALTER TABLE children ALTER COLUMN child_code SET DEFAULT privacy.new_child_code();
ALTER TABLE children ALTER COLUMN child_code SET NOT NULL;
ALTER TABLE children ADD CONSTRAINT children_child_code_key UNIQUE(child_code);
ALTER TABLE children ADD CONSTRAINT child_code_format CHECK(child_code ~ '^(CDIS-[0-9]{3,8}|CH-[A-F0-9]{24})$');
ALTER TABLE cases DROP CONSTRAINT cases_child_id_key;
CREATE INDEX cases_child_history ON cases(child_id,created_at);

CREATE TABLE child_identities(
 child_id text PRIMARY KEY REFERENCES children(id) DEFERRABLE INITIALLY DEFERRED,
 first_name jsonb, last_name jsonb, birth_date date,
 personal_information jsonb NOT NULL DEFAULT '{}',
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
-- Legacy full names are preserved verbatim. Never guess the split of Arabic compound names.
INSERT INTO child_identities(child_id,birth_date,personal_information)
 SELECT id,nullif(payload->>'birthDate','')::date,payload-'id' FROM children;
UPDATE child_identities i SET personal_information=i.personal_information||coalesce((
 SELECT jsonb_object_agg(x.key,x.value) FROM cases c JOIN case_profiles p ON p.case_id=c.id,
 LATERAL jsonb_each(p.payload) x WHERE c.child_id=i.child_id
 AND x.key IN ('address','phone','father','mother','school')), '{}');
UPDATE children SET payload=jsonb_build_object('id',id,'name',jsonb_build_object('ar',child_code,'fr',child_code),'child_code',child_code);
CREATE TABLE child_identity_aliases(child_id text NOT NULL REFERENCES children(id) DEFERRABLE INITIALLY DEFERRED, information jsonb NOT NULL);
REVOKE ALL ON child_identity_aliases FROM PUBLIC;
ALTER TABLE child_identity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_identity_aliases FORCE ROW LEVEL SECURITY;
INSERT INTO child_identity_aliases SELECT child_id,personal_information FROM child_identities;
CREATE FUNCTION privacy.remember_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 INSERT INTO public.child_identity_aliases VALUES(NEW.child_id,NEW.personal_information||jsonb_build_object('first_name',NEW.first_name,'last_name',NEW.last_name));
 RETURN NEW;
END $$;
CREATE TRIGGER remember_identity AFTER INSERT OR UPDATE ON child_identities FOR EACH ROW EXECUTE FUNCTION privacy.remember_identity();

CREATE OR REPLACE FUNCTION authz.valid_purpose() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('masar.purpose',true),'') IN ('identity','case.read','case.write','group.read','group.manage','forms.read','forms.write','browser.read','recommendation.generate','feedback.write','roadmap.write','catalogue.read','catalogue.write','audit.read','forum.read','forum.write','child.identity.read','child.identity.write','journey.summary.read','journey.summary.generate','journey.summary.review');
$$;
CREATE FUNCTION authz.identity_allowed(case_key text,operation text DEFAULT 'read') RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,authz AS $$
 SELECT current_setting('masar.purpose',true)='child.identity.'||operation
 AND authz.case_allowed(case_key) AND authz.capability('child.identity.'||operation)
 AND authz.has_scope(case_key,'child.identity.'||operation);
$$;
SET CONSTRAINTS ALL IMMEDIATE;
ALTER TABLE child_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_read ON child_identities FOR SELECT USING(EXISTS(
 SELECT 1 FROM cases c WHERE c.child_id=child_identities.child_id
 AND (authz.identity_allowed(c.id) OR authz.identity_allowed(c.id,'write'))));
CREATE POLICY identity_update ON child_identities FOR UPDATE USING(EXISTS(
 SELECT 1 FROM cases c WHERE c.child_id=child_identities.child_id AND authz.identity_allowed(c.id,'write')))
 WITH CHECK(EXISTS(SELECT 1 FROM cases c WHERE c.child_id=child_identities.child_id AND authz.identity_allowed(c.id,'write')));

CREATE FUNCTION privacy.capture_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,privacy AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.child_code<>OLD.child_code) THEN
  RAISE EXCEPTION 'PERMANENT_CHILD_CODE' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
  INSERT INTO public.child_identities(child_id,first_name,last_name,birth_date,personal_information)
  VALUES(NEW.id,NEW.payload->'first_name',NEW.payload->'last_name',nullif(NEW.payload->>'birthDate','')::date,NEW.payload-'id');
 ELSIF NEW.payload IS DISTINCT FROM OLD.payload THEN
  RAISE EXCEPTION 'IDENTITY_REQUIRES_DEDICATED_SERVICE' USING ERRCODE='23514';
 END IF;
 NEW.payload=jsonb_build_object('id',NEW.id,'child_code',NEW.child_code,'name',jsonb_build_object('ar',NEW.child_code,'fr',NEW.child_code));
 RETURN NEW;
END $$;
CREATE TRIGGER child_identity_capture BEFORE INSERT OR UPDATE ON children FOR EACH ROW EXECUTE FUNCTION privacy.capture_identity();

-- Internal recursive helper receives a dictionary assembled inside the definer boundary.
-- The dictionary itself is never returned to an application or indexing principal.
CREATE FUNCTION privacy.apply(value jsonb,terms text[],replacements text[]) RETURNS jsonb LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,privacy AS $$
DECLARE result jsonb; pair record; item jsonb; content text; lowered text; pattern text; ch text; n integer;
BEGIN
 IF jsonb_typeof(value)='object' THEN
  -- A verified employee projection is a separate domain from a child's identity.
  -- Containment prevents a caller from smuggling arbitrary narrative under a staff label.
  IF value ? 'role' AND value ? 'id' AND value ? 'name' AND EXISTS(
    SELECT 1 FROM public.employees e WHERE e.id=value->>'id' AND e.payload @> value) THEN RETURN value; END IF;
  result='{}';
  FOR pair IN SELECT * FROM jsonb_each(value) LOOP
   IF pair.key IN ('mode','identity_mode','ai_mode','generation_method','validation_status','status','role') AND pair.value#>>'{}'=ANY(ARRAY['demo','local','ai','manual','deterministic','deterministic_demo','deterministic_unavailable','deterministic_invalid_output','draft','preview','approved','rejected','active','closed','archived','completed','validated','planned','inProgress','postponed','cancelled','current','pending','future','notStarted','social','educator','psychologist','administration','limited','unavailable','tested-cpu','model_unavailable','abstained']) THEN
    result=result||jsonb_build_object(pair.key,pair.value); CONTINUE;
   END IF;
   IF pair.key IN ('id','caseId','case_id','childId','child_id','sourceId','source_id','documentId','document_id','reference_id','content_hash','context_fingerprint','sha256','csrf_token','sessionId','session_id','employeeId','employee_id','professionalId','professional_id','authorId','created_by','validated_by','author_id','formId','form_id','group_id','groupIds','path','model_version','modelExplanationSource','fingerprint') THEN
    result=result||jsonb_build_object(pair.key,pair.value); CONTINUE;
   END IF;
   IF pair.key IN ('first_name','last_name','birth_date','personal_information') THEN CONTINUE; END IF;
   IF pair.key IN ('birthDate','birthplace','address','phone','father','mother','school') THEN
    result=result||jsonb_build_object(pair.key,'');
   ELSE result=result||jsonb_build_object(pair.key,privacy.apply(pair.value,terms,replacements)); END IF;
  END LOOP; RETURN result;
 ELSIF jsonb_typeof(value)='array' THEN
  result='[]'; FOR item IN SELECT * FROM jsonb_array_elements(value) LOOP result=result||jsonb_build_array(privacy.apply(item,terms,replacements)); END LOOP; RETURN result;
 ELSIF jsonb_typeof(value)<>'string' THEN RETURN value; END IF;
 content=value#>>'{}';
 lowered=lower(content);
 IF cardinality(terms)>0 THEN
  FOR n IN SELECT idx FROM generate_subscripts(terms,1) idx WHERE position(terms[idx] in lowered)>0 LOOP
   pattern='';
   FOREACH ch IN ARRAY regexp_split_to_array(terms[n],'') LOOP
    IF position(ch in ('.^$*+?()[]{}|'||chr(92)))>0 THEN pattern=pattern||chr(92); END IF;
    pattern=pattern||ch;
   END LOOP;
   content=regexp_replace(content,'(?<![[:alnum:]_])'||pattern||'(?![[:alnum:]_])',replacements[n],'gi');
  END LOOP;
 END IF;
 content=regexp_replace(content,'[[:alnum:]._%+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,}','[•••]','gi');
 IF content !~ '^(CH-)?[A-Fa-f0-9-]{16,128}$' THEN
  content=regexp_replace(content,'(?<![[:alnum:]])[0-9]{8,12}(?![[:alnum:]])','[•••]','g');
 END IF;
 content=regexp_replace(content,'[+]216[ .-]?[0-9]{2}[ .-]?[0-9]{3}[ .-]?[0-9]{3}','[•••]','g');
 content=regexp_replace(content,'(?<![[:alnum:]])[2-9][0-9][ .-][0-9]{3}[ .-][0-9]{3}(?![[:alnum:]])','[•••]','g');
 RETURN to_jsonb(content);
END $$;

CREATE FUNCTION privacy.project(value jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,authz,privacy AS $$
DECLARE terms text[]; replacements text[];
BEGIN
 SELECT array_agg(lower(term) ORDER BY length(term) DESC,term),array_agg(replacement ORDER BY length(term) DESC,term)
 INTO terms,replacements FROM (
  SELECT term,CASE WHEN count(DISTINCT replacement)=1 THEN min(replacement) ELSE '[•••]' END AS replacement FROM (
   SELECT t.term,CASE WHEN authz.active_employee() AND EXISTS(SELECT 1 FROM public.cases c WHERE c.child_id=i.child_id AND authz.case_allowed(c.id))
      THEN ch.child_code ELSE '[•••]' END AS replacement
   FROM (SELECT child_id,personal_information,first_name,last_name FROM public.child_identities
         UNION ALL SELECT child_id,information,CASE WHEN jsonb_typeof(information->'first_name')='object' THEN information->'first_name' END,
              CASE WHEN jsonb_typeof(information->'last_name')='object' THEN information->'last_name' END FROM public.child_identity_aliases) i JOIN public.children ch ON ch.id=i.child_id
   CROSS JOIN LATERAL (
    SELECT n.value AS term FROM jsonb_each_text(coalesce(i.personal_information->'name','{}')) n
    UNION SELECT n.value FROM jsonb_each_text(coalesce(i.first_name,'{}')) n
    UNION SELECT n.value FROM jsonb_each_text(coalesce(i.last_name,'{}')) n
    UNION SELECT token FROM jsonb_each_text(coalesce(i.personal_information->'name','{}')) n,
       LATERAL regexp_split_to_table(n.value,'[[:space:]]+') token WHERE length(token)>=3
   ) t WHERE length(t.term)>=3
   UNION ALL
   SELECT v,'[•••]' FROM (SELECT personal_information FROM public.child_identities UNION ALL SELECT information FROM public.child_identity_aliases) i,
    LATERAL jsonb_each_text(i.personal_information) x(k,v)
    WHERE k IN ('address','phone','father','mother','school','birthDate','birthplace') AND length(v)>=3
   UNION ALL
   SELECT formatted,'[•••]' FROM (
    SELECT nullif(personal_information->>'birthDate','')::date AS born FROM public.child_identities
    UNION SELECT nullif(information->>'birthDate','')::date FROM public.child_identity_aliases
   ) birthdays CROSS JOIN LATERAL unnest(ARRAY[to_char(born,'DD/MM/YYYY'),to_char(born,'DD-MM-YYYY'),to_char(born,'YYYY/MM/DD')]) formatted
   WHERE born IS NOT NULL
   UNION ALL
   SELECT v,'[•••]' FROM public.case_profiles p,
    LATERAL jsonb_each_text(p.payload) x(k,v)
    WHERE k IN ('address','phone','father','mother','school') AND length(v)>=3
  ) dictionary GROUP BY term
 ) unique_terms;
 RETURN privacy.apply(value,coalesce(terms,ARRAY[]::text[]),coalesce(replacements,ARRAY[]::text[]));
END $$;

CREATE FUNCTION authz.child_age(case_key text) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,authz AS $$
 SELECT extract(year FROM age(current_date,i.birth_date))::integer FROM public.child_identities i JOIN public.cases c ON c.child_id=i.child_id
 WHERE c.id=case_key AND authz.case_allowed(c.id) AND authz.capability('recommendation.use')
 AND current_setting('masar.purpose',true) IN ('recommendation.generate','roadmap.write');
$$;

-- Once-only policy additions. Bootstrap never restores revoked scopes.
INSERT INTO role_permissions(role_id,permission) SELECT id,'child.identity.read' FROM roles WHERE id IN ('social','administration') ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id,permission) SELECT id,'child.identity.write' FROM roles WHERE id='social' ON CONFLICT DO NOTHING;
INSERT INTO assignment_scopes(case_assignment_id,scope_code,granted_by)
 SELECT a.id,'child.identity.read',a.assigned_by FROM case_assignments a WHERE role_id IN ('social','administration') ON CONFLICT DO NOTHING;
INSERT INTO assignment_scopes(case_assignment_id,scope_code,granted_by)
 SELECT a.id,'child.identity.write',a.assigned_by FROM case_assignments a WHERE role_id='social' ON CONFLICT DO NOTHING;
INSERT INTO group_assignment_scopes(group_assignment_id,scope_code,granted_by)
 SELECT a.id,'child.identity.read',a.assigned_by FROM group_assignments a WHERE role_id IN ('social','administration') ON CONFLICT DO NOTHING;
INSERT INTO group_assignment_scopes(group_assignment_id,scope_code,granted_by)
 SELECT a.id,'child.identity.write',a.assigned_by FROM group_assignments a WHERE role_id='social' ON CONFLICT DO NOTHING;

-- Existing derived text/embeddings are invalidated, never the immutable originals.
UPDATE document_chunks SET chunk_text=privacy.project(to_jsonb(chunk_text))#>>'{}',normalized_text='',embedding=NULL,embedding_model_version=NULL;
INSERT INTO outbox_events(event_type,aggregate_id,source_version,payload)
 SELECT 'DOCUMENT_VERSION_CREATED',id,version,jsonb_build_object('privacy_reindex',true) FROM document_versions
 WHERE status IN ('completed','validated','APPROVED') ON CONFLICT DO NOTHING;
UPDATE outbox_events SET processed_at=NULL,attempts=0,next_attempt_at=now() WHERE event_type='DOCUMENT_VERSION_CREATED';
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA privacy FROM PUBLIC;
GRANT USAGE ON SCHEMA privacy TO masar_app,masar_indexer;
GRANT EXECUTE ON FUNCTION privacy.project(jsonb),privacy.new_child_code() TO masar_app,masar_indexer;
REVOKE ALL ON FUNCTION authz.identity_allowed(text,text),authz.child_age(text) FROM PUBLIC;
GRANT SELECT,UPDATE ON child_identities TO masar_app;
