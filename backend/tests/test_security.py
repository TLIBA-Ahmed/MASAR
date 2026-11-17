import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from backend.db import transaction,one,rows,engine
from backend.authorization import AuthenticatedEmployee,AuthorizationService,Purpose
from .conftest import login

def test_restricted_role_and_forced_rls():
    with transaction('p3',Purpose.CASE_READ) as c:
        role=one(c,'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')
        assert not role['rolsuper'] and not role['rolbypassrls']
        assert all(r['relforcerowsecurity'] for r in rows(c,"SELECT relforcerowsecurity FROM pg_class WHERE relname IN ('cases','document_versions','roadmap_objectives','recommendation_runs','outbox_events')"))

@pytest.mark.parametrize('employee,purpose',[(None,'case.read'),('p3','UNTRUSTED_BROWSER_PURPOSE'),('unknown','case.read')])
def test_deny_default(employee,purpose):
    with transaction(employee,purpose) as c:assert not rows(c,'SELECT id FROM cases')

def test_group_scopes_expiry_cross_centre():
    with transaction('p3',Purpose.GROUP_READ) as c:
        policy=AuthorizationService(c,AuthenticatedEmployee('p3','test'))
        assert policy.can_access_group('group-a')
        assert not policy.can_access_group('group-b')
        assert not policy.can_access_group('group-c')
        assert not policy.can_access_case('CDIS-033')
        assert not policy.can_access_case('CDIS-024','psychological')
        assert policy.can_access_case('CDIS-024','educational')
        assert not rows(c,"SELECT id FROM documents WHERE category='psychological'")

def test_role_alone_and_scope_not_authority():
    with transaction('p6',Purpose.CASE_READ) as c:
        assert rows(c,'SELECT id FROM cases')
        assert not rows(c,"SELECT id FROM documents WHERE category IN ('psychological','social','educational')")

def test_pool_context_reset_and_rollback():
    with transaction('p2',Purpose.CASE_READ) as c:assert rows(c,'SELECT id FROM cases')
    with engine().connect() as c:
        assert not one(c,"SELECT nullif(current_setting('masar.employee_id',true),'') AS employee")['employee']
        assert not rows(c,'SELECT id FROM cases')
    with pytest.raises(RuntimeError):
        with transaction('p3',Purpose.CASE_READ):raise RuntimeError('rollback')
    with transaction() as c:assert not rows(c,'SELECT id FROM cases')

def test_immediate_revocation_and_removal_rollback():
    with engine('admin').connect() as admin:
        tx=admin.begin()
        try:
            admin.execute(text("UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='p3-group-a'"))
            # Same transaction under restricted application role; uncommitted fixture stays isolated.
            admin.exec_driver_sql('SET LOCAL ROLE masar_app')
            admin.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','case.read',true)"))
            assert not rows(admin,'SELECT id FROM cases')
        finally:tx.rollback()
    with engine('admin').connect() as admin:
        tx=admin.begin()
        try:
            admin.execute(text("UPDATE child_group_memberships SET membership_status='ENDED',valid_to=now() WHERE group_id='group-a' AND case_id='CDIS-024'"))
            admin.exec_driver_sql('SET LOCAL ROLE masar_app')
            admin.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','case.read',true)"))
            assert not one(admin,"SELECT id FROM cases WHERE id='CDIS-024'")
            admin.execute(text("SELECT set_config('masar.employee_id','p1',true)"))
            assert one(admin,"SELECT id FROM cases WHERE id='CDIS-024'")
        finally:tx.rollback()

def test_explicit_confidential_grant_is_record_specific():
    with engine('admin').connect() as c:
        tx=c.begin()
        try:
            doc=one(c,"SELECT id FROM documents WHERE case_id='CDIS-024' AND category='psychological' LIMIT 1")
            assert doc
            c.execute(text("INSERT INTO record_grants(employee_id,case_id,resource_id,category,granted_by) VALUES('p3','CDIS-024',:id,'psychological','p4')"),{'id':doc['id']})
            c.exec_driver_sql('SET LOCAL ROLE masar_app')
            c.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','forms.read',true)"))
            assert one(c,'SELECT id FROM documents WHERE id=:id',id=doc['id'])
            assert len(rows(c,"SELECT id FROM documents WHERE category='psychological'"))==1
        finally:tx.rollback()

def test_no_app_outbox_or_sessions_leak():
    with transaction('p3',Purpose.CASE_READ) as c:
        assert not rows(c,'SELECT id FROM outbox_events')
        assert not rows(c,'SELECT id FROM sessions')

def test_unauthenticated_and_forged_roles(client):
    assert client.get('/api/v1/cases/CDIS-024').status_code==401
    assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3','roles':['administration']}).status_code==422
    login(client)
    assert client.get('/api/v1/cases/CDIS-033',headers={'X-Role':'administration','X-Purpose':'audit.read'}).status_code==404
    assert client.get('/api/v1/groups/group-b/children').status_code==404
    assert client.get('/api/v1/groups/group-a/children').json()['count']==6

def test_csrf_required(client):
    client.headers.pop('X-Masar-CSRF')
    assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3'}).status_code==403

def test_immutable_validated_document():
    with pytest.raises(DBAPIError):
        with transaction(principal='admin') as c:
            c.execute(text("UPDATE document_versions SET payload='{}' WHERE id=(SELECT id FROM document_versions WHERE status='validated' LIMIT 1)"))

def test_account_inactive_and_centre_expired():
    with engine('admin').connect() as c:
        tx=c.begin()
        try:
            c.execute(text("UPDATE employee_centres SET active=false WHERE employee_id='p3'"))
            c.exec_driver_sql('SET LOCAL ROLE masar_app')
            c.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','case.read',true)"))
            assert not rows(c,'SELECT id FROM cases')
        finally:tx.rollback()
