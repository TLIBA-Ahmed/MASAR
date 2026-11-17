CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE SCHEMA IF NOT EXISTS authz;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE TABLE centres(id text PRIMARY KEY, payload jsonb NOT NULL);
CREATE TABLE employees(id text PRIMARY KEY, active boolean NOT NULL DEFAULT true, payload jsonb NOT NULL, authz_version integer NOT NULL DEFAULT 1);
CREATE TABLE roles(id text PRIMARY KEY);
CREATE TABLE employee_roles(employee_id text REFERENCES employees, role_id text REFERENCES roles, PRIMARY KEY(employee_id,role_id));
CREATE TABLE role_permissions(role_id text REFERENCES roles, permission text NOT NULL, PRIMARY KEY(role_id,permission));
CREATE TABLE employee_centres(employee_id text REFERENCES employees, centre_id text REFERENCES centres, active boolean NOT NULL DEFAULT true, PRIMARY KEY(employee_id,centre_id));
CREATE TABLE sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), token_hash text UNIQUE NOT NULL, employee_id text REFERENCES employees NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE children(id text PRIMARY KEY, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE cases(id text PRIMARY KEY, child_id text UNIQUE NOT NULL REFERENCES children, centre_id text NOT NULL REFERENCES centres, payload jsonb NOT NULL, version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX cases_centre ON cases(centre_id);
CREATE TABLE child_groups(id text PRIMARY KEY, centre_id text NOT NULL REFERENCES centres, group_code text UNIQUE NOT NULL, name jsonb NOT NULL, description jsonb NOT NULL DEFAULT '{}', status text NOT NULL CHECK(status IN ('ACTIVE','INACTIVE')), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE child_group_memberships(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id text NOT NULL REFERENCES child_groups, case_id text NOT NULL REFERENCES cases, membership_status text NOT NULL CHECK(membership_status IN ('ACTIVE','ENDED','TRANSFERRED')), valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz, added_by text REFERENCES employees, removed_by text REFERENCES employees, CHECK(valid_to IS NULL OR valid_to>=valid_from));
CREATE INDEX memberships_active ON child_group_memberships(group_id,case_id,membership_status,valid_to);
CREATE UNIQUE INDEX memberships_current ON child_group_memberships(group_id,case_id) WHERE membership_status='ACTIVE' AND valid_to IS NULL;
CREATE TABLE group_assignments(id text PRIMARY KEY, group_id text NOT NULL REFERENCES child_groups, employee_id text NOT NULL REFERENCES employees, role_id text NOT NULL REFERENCES roles, assignment_status text NOT NULL CHECK(assignment_status IN ('ACTIVE','EXPIRED','REVOKED')), valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz, assigned_by text REFERENCES employees, CHECK(valid_to IS NULL OR valid_to>=valid_from));
CREATE TABLE case_assignments(id text PRIMARY KEY, case_id text NOT NULL REFERENCES cases, employee_id text NOT NULL REFERENCES employees, role_id text NOT NULL REFERENCES roles, assignment_status text NOT NULL CHECK(assignment_status IN ('ACTIVE','EXPIRED','REVOKED')), valid_from timestamptz NOT NULL DEFAULT now(), valid_to timestamptz, assigned_by text REFERENCES employees, CHECK(valid_to IS NULL OR valid_to>=valid_from));
CREATE TABLE group_assignment_scopes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_assignment_id text NOT NULL REFERENCES group_assignments, scope_code text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), granted_by text REFERENCES employees, revoked_at timestamptz, UNIQUE(group_assignment_id,scope_code));
CREATE TABLE assignment_scopes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_assignment_id text NOT NULL REFERENCES case_assignments, scope_code text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(), granted_by text REFERENCES employees, revoked_at timestamptz, UNIQUE(case_assignment_id,scope_code));
CREATE INDEX group_assignments_employee ON group_assignments(employee_id,assignment_status,valid_to);
CREATE INDEX case_assignments_employee ON case_assignments(employee_id,assignment_status,valid_to);
ALTER TABLE group_assignments ADD FOREIGN KEY(employee_id,role_id) REFERENCES employee_roles;
ALTER TABLE case_assignments ADD FOREIGN KEY(employee_id,role_id) REFERENCES employee_roles;
CREATE TABLE record_grants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id text NOT NULL REFERENCES employees, case_id text NOT NULL REFERENCES cases, resource_id text NOT NULL, category text NOT NULL, action text NOT NULL DEFAULT 'read', valid_until timestamptz, revoked_at timestamptz, granted_by text NOT NULL REFERENCES employees);

DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['case_profiles','case_status_history','case_transfers','observations','initial_assessments','professional_notes','roadmaps','roadmap_versions','roadmap_objectives','planned_interventions','intervention_events','appointments','tasks'] LOOP
    EXECUTE format('CREATE TABLE %I (id text PRIMARY KEY, case_id text NOT NULL REFERENCES cases, author_id text NOT NULL REFERENCES employees, category text NOT NULL, sensitivity integer NOT NULL DEFAULT 1 CHECK(sensitivity BETWEEN 0 AND 3), status text NOT NULL DEFAULT ''ACTIVE'', version integer NOT NULL DEFAULT 1 CHECK(version>0), source_id text, payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())',tab);
    EXECUTE format('CREATE INDEX %I ON %I(case_id,category,created_at)',tab||'_case',tab);
  END LOOP;
END $$;
ALTER TABLE roadmap_versions ADD COLUMN roadmap_id text REFERENCES roadmaps;
ALTER TABLE roadmap_objectives ADD COLUMN roadmap_id text REFERENCES roadmaps;
ALTER TABLE planned_interventions ADD COLUMN roadmap_id text REFERENCES roadmaps;
CREATE TABLE assessment_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id text NOT NULL REFERENCES initial_assessments, item_key text NOT NULL, value jsonb NOT NULL, UNIQUE(assessment_id,item_key));

CREATE TABLE form_definitions(id text PRIMARY KEY, version integer NOT NULL, category text NOT NULL, payload jsonb NOT NULL);
CREATE TABLE interventions(id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('activity','resource')), category text NOT NULL, approval_status text NOT NULL CHECK(approval_status IN ('DEMO_APPROVED','APPROVED','DRAFT','RETIRED')), active boolean NOT NULL DEFAULT true, version integer NOT NULL DEFAULT 1, required_roles text[] NOT NULL DEFAULT '{}', payload jsonb NOT NULL);
CREATE TABLE activity_sessions(id text PRIMARY KEY, centre_id text NOT NULL REFERENCES centres, activity_id text NOT NULL REFERENCES interventions, author_id text NOT NULL REFERENCES employees, status text NOT NULL, payload jsonb NOT NULL);
CREATE TABLE session_participants(session_id text NOT NULL REFERENCES activity_sessions, case_id text NOT NULL REFERENCES cases, payload jsonb NOT NULL, PRIMARY KEY(session_id,case_id));
CREATE TABLE documents(id text PRIMARY KEY, case_id text REFERENCES cases, centre_id text REFERENCES centres, category text NOT NULL, sensitivity integer NOT NULL DEFAULT 1 CHECK(sensitivity BETWEEN 0 AND 3), title jsonb NOT NULL, approval_status text NOT NULL, created_by text NOT NULL REFERENCES employees, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE document_versions(id text PRIMARY KEY, document_id text NOT NULL REFERENCES documents, case_id text REFERENCES cases, form_id text REFERENCES form_definitions, version integer NOT NULL CHECK(version>0), language text NOT NULL CHECK(language IN ('ar','fr')), status text NOT NULL, author_id text NOT NULL REFERENCES employees, payload jsonb NOT NULL, storage_reference text, sha256 text, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(document_id,version));
CREATE TABLE institutional_sources(id text PRIMARY KEY, title jsonb NOT NULL, status text NOT NULL, version integer NOT NULL DEFAULT 1, source_reference text NOT NULL);
CREATE TABLE knowledge_items(id text PRIMARY KEY, source_id text REFERENCES institutional_sources, kind text NOT NULL, category text NOT NULL, version integer NOT NULL DEFAULT 1, approval_status text NOT NULL, centre_id text REFERENCES centres, required_roles text[] NOT NULL DEFAULT '{}', payload jsonb NOT NULL);
CREATE TABLE document_chunks(id text PRIMARY KEY, document_id text REFERENCES documents, document_version_id text REFERENCES document_versions, knowledge_id text REFERENCES knowledge_items, case_id text REFERENCES cases, centre_id text REFERENCES centres, category text NOT NULL, sensitivity integer NOT NULL DEFAULT 1, chunk_text text NOT NULL, normalized_text text NOT NULL, language text NOT NULL, page_number integer, section_title text, chunk_order integer NOT NULL, source_version integer NOT NULL, embedding vector(384), embedding_model_version text, access_policy_reference text NOT NULL, search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple',normalized_text)) STORED, CHECK(document_version_id IS NOT NULL OR knowledge_id IS NOT NULL));
CREATE INDEX chunks_text ON document_chunks USING gin(search_vector);
CREATE INDEX chunks_case ON document_chunks(case_id,document_version_id,source_version);

CREATE TABLE recommendation_templates(id text PRIMARY KEY, code text UNIQUE NOT NULL, version integer NOT NULL DEFAULT 1, active boolean NOT NULL DEFAULT true, approved_by text NOT NULL REFERENCES employees, approved_at timestamptz NOT NULL DEFAULT now(), required_scopes text[] NOT NULL, allowed_case_statuses text[] NOT NULL DEFAULT '{active}', input_schema jsonb NOT NULL, output_schema jsonb NOT NULL, system_one_config_id text NOT NULL, slm_prompt_version text NOT NULL, payload jsonb NOT NULL);
CREATE TABLE template_roles(template_id text NOT NULL REFERENCES recommendation_templates, role_id text NOT NULL REFERENCES roles, PRIMARY KEY(template_id,role_id));
CREATE TABLE recommendation_runs(id text PRIMARY KEY, employee_id text NOT NULL REFERENCES employees, case_id text NOT NULL REFERENCES cases, template_id text NOT NULL REFERENCES recommendation_templates, status text NOT NULL, input_payload jsonb NOT NULL, authz_fingerprint text NOT NULL, model_versions jsonb NOT NULL, limitations jsonb NOT NULL DEFAULT '[]', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE recommendation_candidates(id text PRIMARY KEY, run_id text NOT NULL REFERENCES recommendation_runs, intervention_id text NOT NULL REFERENCES interventions, score double precision NOT NULL CHECK(score BETWEEN 0 AND 100), payload jsonb NOT NULL, UNIQUE(run_id,intervention_id));
CREATE TABLE recommendation_feedback(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), candidate_id text NOT NULL REFERENCES recommendation_candidates, employee_id text NOT NULL REFERENCES employees, status text NOT NULL CHECK(status IN ('ACCEPTED','MODIFIED','REJECTED','DEFERRED')), reason text NOT NULL CHECK(length(trim(reason))>0), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE model_versions(id text PRIMARY KEY, name text NOT NULL, revision text NOT NULL, licence text NOT NULL, runtime text NOT NULL, quantization text, local_path text NOT NULL, status text NOT NULL, capabilities jsonb NOT NULL, manifest jsonb NOT NULL);
CREATE TABLE prompt_versions(id text PRIMARY KEY, purpose text NOT NULL, language text NOT NULL, version integer NOT NULL, content text NOT NULL);
CREATE TABLE audit_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id text REFERENCES employees, action text NOT NULL, resource_type text NOT NULL, resource_id text, success boolean NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE access_review_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id text NOT NULL REFERENCES employees, actor_id text NOT NULL REFERENCES employees, action text NOT NULL, resource_id text NOT NULL, reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE outbox_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id text REFERENCES employees, event_type text NOT NULL, aggregate_id text NOT NULL, source_version integer NOT NULL DEFAULT 1, payload jsonb NOT NULL DEFAULT '{}', attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, last_error_code text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX outbox_pending ON outbox_events(next_attempt_at,created_at) WHERE processed_at IS NULL;

CREATE FUNCTION authz.guard_immutable_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' OR OLD.status IN ('validated','VALIDATED','APPROVED') THEN RAISE EXCEPTION 'IMMUTABLE_VERSION' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER document_version_immutable BEFORE UPDATE OR DELETE ON document_versions FOR EACH ROW EXECUTE FUNCTION authz.guard_immutable_version();
CREATE TRIGGER roadmap_version_immutable BEFORE UPDATE OR DELETE ON roadmap_versions FOR EACH ROW EXECUTE FUNCTION authz.guard_immutable_version();

CREATE FUNCTION authz.normalize_text(value text) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT trim(regexp_replace(translate(lower(public.unaccent(value)), 'أإآٱىةـ', 'اااايه'), '[^[:alnum:]ء-ي-]+',' ','g'));
$$;
