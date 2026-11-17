ALTER TABLE centres ADD COLUMN governorate_id text REFERENCES governorates(id);
ALTER TABLE centres ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE centres ADD COLUMN is_demo boolean NOT NULL DEFAULT false;
UPDATE centres c SET governorate_id=g.id FROM governorates g
 WHERE authz.normalize_text(c.payload->'region'->>'fr')=authz.normalize_text(g.name->>'fr');
UPDATE centres SET governorate_id='TN-34',is_demo=true WHERE id='siliana';
UPDATE centres SET governorate_id='TN-81',is_demo=true WHERE id='gabes';
-- Fail atomically instead of inventing a location for an unknown existing centre.
ALTER TABLE centres ALTER COLUMN governorate_id SET NOT NULL;
CREATE INDEX centres_governorate ON centres(governorate_id) WHERE active;
ALTER TABLE employees ADD COLUMN is_demo_identity boolean NOT NULL DEFAULT false;
UPDATE employees SET is_demo_identity=true WHERE id IN ('p1','p2','p3','p4','p5','p6');
ALTER TABLE sessions ADD COLUMN selected_centre_id text REFERENCES centres(id);

CREATE OR REPLACE FUNCTION authz.in_centre(centre text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT authz.active_employee() AND EXISTS(SELECT 1 FROM public.employee_centres ec JOIN public.centres c ON c.id=ec.centre_id
 WHERE ec.employee_id=authz.employee_id() AND ec.centre_id=centre AND ec.active AND c.active)
$$;

CREATE FUNCTION authz.entry_centre_allowed(employee_key text,centre_key text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT EXISTS(SELECT 1 FROM public.employees e JOIN public.employee_centres ec ON ec.employee_id=e.id JOIN public.centres c ON c.id=ec.centre_id
 WHERE e.id=employee_key AND e.active AND ec.centre_id=centre_key AND ec.active AND c.active
 AND EXISTS(SELECT 1 FROM public.employee_roles er JOIN public.role_permissions rp ON rp.role_id=er.role_id WHERE er.employee_id=e.id AND rp.permission='general.read')
 AND (
  EXISTS(SELECT 1 FROM public.group_assignments a JOIN public.child_groups g ON g.id=a.group_id JOIN public.group_assignment_scopes s ON s.group_assignment_id=a.id
   WHERE a.employee_id=e.id AND g.centre_id=c.id AND g.status='ACTIVE' AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()) AND s.scope_code='general.read' AND s.revoked_at IS NULL)
  OR EXISTS(SELECT 1 FROM public.case_assignments a JOIN public.cases ca ON ca.id=a.case_id JOIN public.assignment_scopes s ON s.case_assignment_id=a.id
   WHERE a.employee_id=e.id AND ca.centre_id=c.id AND a.assignment_status='ACTIVE' AND a.valid_from<=now() AND (a.valid_to IS NULL OR a.valid_to>now()) AND s.scope_code='general.read' AND s.revoked_at IS NULL)
 ))
$$;

CREATE FUNCTION authz.demo_entry_profiles(governorate_key text,centre_key text) RETURNS TABLE(id text,payload jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT e.id,jsonb_build_object('id',e.id,'name',e.payload->'name','role',e.payload->'role','specialty',e.payload->'specialty','centerId',c.id)
 FROM public.employees e JOIN public.employee_centres ec ON ec.employee_id=e.id JOIN public.centres c ON c.id=ec.centre_id
 WHERE e.is_demo_identity AND c.is_demo AND c.active AND c.governorate_id=governorate_key AND c.id=centre_key
 AND authz.entry_centre_allowed(e.id,c.id) ORDER BY e.id
$$;

CREATE OR REPLACE FUNCTION authz.demo_identities() RETURNS TABLE(id text,payload jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT e.id,jsonb_build_object('id',e.id,'name',e.payload->'name','role',e.payload->'role','specialty',e.payload->'specialty','centerId',e.payload->'centerId')
 FROM public.employees e WHERE e.active AND e.is_demo_identity
 AND EXISTS(SELECT 1 FROM public.employee_centres ec JOIN public.centres c ON c.id=ec.centre_id WHERE ec.employee_id=e.id AND c.is_demo AND authz.entry_centre_allowed(e.id,c.id)) ORDER BY e.id
$$;

CREATE OR REPLACE FUNCTION authz.create_demo_session(employee_key text,hash text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 DECLARE new_id uuid; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=employee_key AND e.active AND e.is_demo_identity
   AND EXISTS(SELECT 1 FROM public.employee_centres ec JOIN public.centres c ON c.id=ec.centre_id WHERE ec.employee_id=e.id AND c.is_demo AND authz.entry_centre_allowed(e.id,c.id)))
 THEN RAISE EXCEPTION 'UNKNOWN_DEMO_IDENTITY' USING ERRCODE='28000'; END IF;
 INSERT INTO public.sessions(token_hash,employee_id,expires_at) VALUES(hash,employee_key,now()+interval '8 hours') RETURNING id INTO new_id; RETURN new_id;
 END $$;

CREATE FUNCTION authz.set_entry_centre(session_key uuid,employee_key text,centre_key text,governorate_key text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 BEGIN
 IF authz.employee_id() IS DISTINCT FROM employee_key OR current_setting('masar.purpose',true)<>'identity'
 OR NOT authz.entry_centre_allowed(employee_key,centre_key)
 OR NOT EXISTS(SELECT 1 FROM public.centres WHERE id=centre_key AND governorate_id=governorate_key AND active)
 THEN RETURN false; END IF;
 UPDATE public.sessions SET selected_centre_id=centre_key WHERE id=session_key AND employee_id=employee_key AND revoked_at IS NULL AND expires_at>now();
 RETURN FOUND;
 END $$;

CREATE FUNCTION authz.session_entry_centre(session_key uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,authz AS $$
 SELECT s.selected_centre_id FROM public.sessions s WHERE s.id=session_key AND s.employee_id=authz.employee_id() AND s.revoked_at IS NULL AND s.expires_at>now()
$$;
REVOKE ALL ON FUNCTION authz.entry_centre_allowed(text,text),authz.demo_entry_profiles(text,text),authz.set_entry_centre(uuid,text,text,text),authz.session_entry_centre(uuid) FROM PUBLIC;
GRANT SELECT ON governorates TO masar_app;
GRANT EXECUTE ON FUNCTION authz.entry_centre_allowed(text,text),authz.demo_entry_profiles(text,text),authz.set_entry_centre(uuid,text,text,text),authz.session_entry_centre(uuid) TO masar_app;
