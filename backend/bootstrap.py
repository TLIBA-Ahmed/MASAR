"""Idempotent local bootstrap. Does not reset existing business data."""
import os
from alembic import command
from alembic.config import Config
from psycopg import sql
from .config import ROOT
from .db import engine


def bootstrap():
    with engine('admin').begin() as conn:
        dbapi = conn.connection.driver_connection
        for name, env in [('masar_app','POSTGRES_APP_PASSWORD'),('masar_indexer','POSTGRES_WORKER_PASSWORD')]:
            exists = dbapi.execute('SELECT 1 FROM pg_roles WHERE rolname=%s',(name,)).fetchone()
            if not exists:
                dbapi.execute(sql.SQL('CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD {}').format(sql.Identifier(name),sql.Literal(os.environ[env])))
    command.upgrade(Config(str(ROOT/'alembic.ini')), 'head')
    with engine('admin').begin() as conn:
        conn.exec_driver_sql('GRANT USAGE ON SCHEMA public,authz TO masar_app,masar_indexer')
        conn.exec_driver_sql('GRANT SELECT ON ALL TABLES IN SCHEMA public TO masar_app')
        conn.exec_driver_sql('GRANT INSERT,UPDATE ON cases,children,case_profiles,observations,initial_assessments,professional_notes,roadmaps,roadmap_versions,roadmap_objectives,planned_interventions,intervention_events,case_status_history,case_transfers,appointments,tasks,child_groups,child_group_memberships,group_assignments,case_assignments,documents,document_versions,activity_sessions,session_participants,recommendation_runs,recommendation_candidates,recommendation_feedback,audit_events,access_review_events TO masar_app')
        conn.exec_driver_sql('GRANT INSERT ON outbox_events TO masar_app')
        conn.exec_driver_sql('GRANT INSERT ON assignment_scopes TO masar_app')
        conn.exec_driver_sql('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA authz TO masar_app')
        conn.exec_driver_sql('GRANT SELECT,UPDATE ON outbox_events TO masar_indexer')
        conn.exec_driver_sql('GRANT SELECT ON documents,document_versions,knowledge_items,interventions TO masar_indexer')
        conn.exec_driver_sql('GRANT INSERT,UPDATE,DELETE,SELECT ON document_chunks TO masar_indexer')
    from .seed import seed
    seed()
    from .forum import seed_forum
    seed_forum()
    from .journey.demo import prepare_journey_demo,preserve_historical_integrations
    prepare_journey_demo()
    preserve_historical_integrations()
    print('PostgreSQL migrations, restricted principals and synthetic seed are ready.')


if __name__=='__main__':
    bootstrap()
