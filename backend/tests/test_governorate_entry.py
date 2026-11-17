"""Synthetic entry registry, server-owned identity and workplace verification."""
import copy
import pytest
from sqlalchemy import text
from backend.config import settings
from backend.db import transaction,one,rows
from backend.identity import EHouwiyaIdentityProvider
from backend.identity.entry import REFERENCE_GOVERNORATES
from .conftest import login

def test_public_catalogue_has_24_bilingual_iso_governorates_without_employee_directory(client):
    data=client.get('/api/v1/entry/governorates').json()
    assert len(data)==24 and len({g['id'] for g in data})==24
    assert sorted(data,key=lambda g:g['id'])==sorted(REFERENCE_GOVERNORATES,key=lambda g:g['id'])
    assert next(g for g in data if g['id']=='TN-34')['name']=={'ar':'سليانة','fr':'Siliana'}
    bootstrap=client.get('/api/v1/bootstrap').json()
    assert bootstrap['professionals']==[]
    assert all(c['isDemo'] and c['governorateId'] in ('TN-34','TN-81','TN-41') for c in bootstrap['centers'])
    assert client.get('/api/v1/entry/governorates/TN-11/centres').json()==[]
    assert client.get('/api/v1/entry/governorates/TN-99/centres').status_code==404

def test_demo_profiles_are_minimal_and_filtered_by_actual_centre_and_governorate(client):
    first=client.get('/api/v1/auth/demo/professionals?governorate_id=TN-34&centre_id=siliana').json()
    assert {p['id'] for p in first}=={'p1','p2','p3','p4','p6'}
    assert all(set(p)=={'id','name','role','specialty','centerId'} for p in first)
    second=client.get('/api/v1/auth/demo/professionals?governorate_id=TN-81&centre_id=gabes').json()
    assert [p['id'] for p in second]==['p5']
    assert client.get('/api/v1/auth/demo/professionals?governorate_id=TN-81&centre_id=siliana').json()==[]

@pytest.mark.parametrize('employee,governorate,centre',[
    ('p3','TN-81','gabes'),('p5','TN-34','siliana'),('p3','TN-81','siliana'),('p3','TN-11','missing')])
def test_workplace_mismatch_never_creates_a_session_or_grant(client,employee,governorate,centre):
    with transaction(principal='admin') as c:
        before=one(c,'SELECT count(*) AS n FROM sessions')['n']
        grants=one(c,'SELECT count(*) AS n FROM employee_centres')['n']
    r=client.post('/api/v1/auth/demo/login',json={'employee_id':employee,'governorate_id':governorate,'centre_id':centre})
    assert r.status_code==403 and r.json()['detail']['code']=='WORKPLACE_MISMATCH'
    assert client.get('/api/v1/workspace').status_code==401
    with transaction(principal='admin') as c:
        assert one(c,'SELECT count(*) AS n FROM sessions')['n']==before
        assert one(c,'SELECT count(*) AS n FROM employee_centres')['n']==grants

def test_verified_demo_identity_keeps_existing_rbac_abac_and_case_scope(client):
    r=client.post('/api/v1/auth/demo/login',json={'employee_id':'p3','governorate_id':'TN-34','centre_id':'siliana'})
    assert r.status_code==200
    client.headers['X-Masar-CSRF']=r.json()['csrf_token']
    me=client.get('/api/v1/me').json()
    assert me['selectedCentreId']=='siliana' and me['centreIds']==['siliana']
    assert me['centres'][0]['governorateId']=='TN-34'
    workspace=client.get('/api/v1/workspace').json()
    assert len(workspace['cases'])==6
    assert client.get('/api/v1/cases/CDIS-024/access').status_code==200
    with transaction(principal='admin') as c:
        other=one(c,"SELECT id FROM cases WHERE centre_id='gabes' LIMIT 1")['id']
    assert client.get(f'/api/v1/cases/{other}/access').status_code==404
    assert client.post('/api/v1/auth/centre',json={'governorate_id':'TN-81','centre_id':'gabes'}).status_code==403
    assert client.get('/api/v1/me').json()['selectedCentreId']=='siliana'

def test_identity_mode_does_not_publish_real_or_non_demo_employee_profiles(client):
    previous_mode=settings.identity_mode
    with transaction(principal='admin') as c:
        c.execute(text("UPDATE employees SET is_demo_identity=false WHERE id='p1'"))
    try:
        data=client.get('/api/v1/auth/demo/professionals?governorate_id=TN-34&centre_id=siliana').json()
        assert 'p1' not in {p['id'] for p in data}
        assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p1','governorate_id':'TN-34','centre_id':'siliana'}).status_code==401
        # The settings instance is frozen; replace its field explicitly for this isolated test.
        object.__setattr__(settings,'identity_mode','ehouwiya')
        assert client.get('/api/v1/bootstrap').json()['professionals']==[]
        assert client.get('/api/v1/bootstrap').json()['centers']==[]
        assert client.get('/api/v1/auth/demo/professionals?governorate_id=TN-34&centre_id=siliana').status_code==403
        assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3'}).status_code==403
        with pytest.raises(Exception) as error:EHouwiyaIdentityProvider().establish_session('not-a-real-identity')
        assert error.value.status_code==501
    finally:
        object.__setattr__(settings,'identity_mode',previous_mode)
        with transaction(principal='admin') as c:c.execute(text("UPDATE employees SET is_demo_identity=true WHERE id='p1'"))

@pytest.mark.parametrize('statement',[
    "UPDATE employees SET active=false WHERE id='p3'",
    "UPDATE employee_centres SET active=false WHERE employee_id='p3'",
    "UPDATE group_assignments SET assignment_status='REVOKED' WHERE employee_id='p3'",
    "UPDATE group_assignment_scopes SET revoked_at=now() WHERE group_assignment_id IN (SELECT id FROM group_assignments WHERE employee_id='p3') AND scope_code='general.read'",
    "UPDATE centres SET active=false WHERE id='siliana'",
])
def test_inactive_or_revoked_assignments_are_rechecked_before_login(client,statement):
    with transaction(principal='admin') as c:
        previous={table:rows(c,f'SELECT * FROM {table}') for table in ['employees','employee_centres','group_assignments','group_assignment_scopes','centres']}
        c.execute(text(statement))
    try:
        profiles=client.get('/api/v1/auth/demo/professionals?governorate_id=TN-34&centre_id=siliana').json()
        assert 'p3' not in {p['id'] for p in profiles}
        assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3','governorate_id':'TN-34','centre_id':'siliana'}).status_code in (401,403)
    finally:
        with transaction(principal='admin') as c:
            for table,values in previous.items():
                for r in values:
                    if table in ('employees','centres'):c.execute(text(f'UPDATE {table} SET active=:active WHERE id=:id'),dict(r))
                    elif table=='employee_centres':c.execute(text('UPDATE employee_centres SET active=:active WHERE employee_id=:employee_id AND centre_id=:centre_id'),dict(r))
                    elif table=='group_assignments':c.execute(text('UPDATE group_assignments SET assignment_status=:assignment_status WHERE id=:id'),dict(r))
                    else:c.execute(text('UPDATE group_assignment_scopes SET revoked_at=:revoked_at WHERE id=:id'),dict(r))

def test_multiple_centres_are_selected_only_from_verified_assignments_after_identity(client):
    with transaction(principal='admin') as c:
        original=one(c,"SELECT payload FROM centres WHERE id='siliana'")['payload']
        payload=copy.deepcopy(original);payload['id']='entry-test-centre'
        import json
        c.execute(text("INSERT INTO centres(id,payload,governorate_id,is_demo) VALUES('entry-test-centre',CAST(:p AS jsonb),'TN-34',true)"),{'p':json.dumps(payload)})
        c.execute(text("INSERT INTO employee_centres(employee_id,centre_id) VALUES('p3','entry-test-centre')"))
        c.execute(text("INSERT INTO child_groups(id,centre_id,group_code,name,status) VALUES('entry-test-group','entry-test-centre','ENTRY-TEST','{}','ACTIVE')"))
        c.execute(text("INSERT INTO group_assignments(id,group_id,employee_id,role_id,assignment_status) VALUES('entry-test-assignment','entry-test-group','p3','educator','ACTIVE')"))
        c.execute(text("INSERT INTO group_assignment_scopes(group_assignment_id,scope_code) VALUES('entry-test-assignment','general.read')"))
    try:
        assert len(client.get('/api/v1/entry/governorates/TN-34/centres').json())==2
        login(client)
        me=client.get('/api/v1/me').json()
        assert set(me['centreIds'])=={'siliana','entry-test-centre'}
        assert client.post('/api/v1/auth/centre',json={'governorate_id':'TN-34','centre_id':'entry-test-centre'}).status_code==200
        assert client.get('/api/v1/me').json()['selectedCentreId']=='entry-test-centre'
        with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='entry-test-assignment'"))
        assert client.post('/api/v1/auth/centre',json={'governorate_id':'TN-34','centre_id':'entry-test-centre'}).status_code==403
    finally:
        with transaction(principal='admin') as c:
            c.execute(text("UPDATE sessions SET selected_centre_id='siliana' WHERE selected_centre_id='entry-test-centre'"))
            c.execute(text("DELETE FROM group_assignment_scopes WHERE group_assignment_id='entry-test-assignment'"))
            c.execute(text("DELETE FROM group_assignments WHERE id='entry-test-assignment'"))
            c.execute(text("DELETE FROM child_groups WHERE id='entry-test-group'"))
            c.execute(text("DELETE FROM employee_centres WHERE centre_id='entry-test-centre'"))
            c.execute(text("DELETE FROM centres WHERE id='entry-test-centre'"))

def test_context_fields_are_bounded_and_cannot_claim_permissions(client):
    assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3','governorate_id':'TN-34'}).status_code==422
    assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3','centre_id':'siliana'}).status_code==422
    assert client.post('/api/v1/auth/demo/login',json={'employee_id':'p3','governorate_id':'TN-34','centre_id':'siliana','roles':['administration']}).status_code==422
    assert client.post('/api/v1/auth/centre',json={'governorate_id':'TN-34','centre_id':'siliana'}).status_code==401

def test_reference_projection_preserves_only_known_registry_ids(client):
    from backend.privacy import ChildPrivacyService
    login(client)
    with transaction(principal='admin') as c:
        identity=one(c,"SELECT personal_information->'name'->>'fr' AS name FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['name']
    with transaction('p3','case.read') as c:
        known={'selectedCentreId':'siliana','centreIds':['siliana','gabes'],'governorateId':'TN-34'}
        assert ChildPrivacyService(c).project(known)==known
        assert ChildPrivacyService(c).project({'selectedCentreId':identity})['selectedCentreId']!=identity
