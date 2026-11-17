import json,re
import uuid
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from backend.db import transaction,one,rows
from backend.privacy import ChildPrivacyService,PrivacyAccessLogFilter
from .conftest import login


def test_projection_and_permanent_codes():
    with transaction('p3','case.read') as c:
        assert ChildPrivacyService(c).project({'safe':'CDIS-024'})=={'safe':'CDIS-024'}
        codes=[r['child_code'] for r in rows(c,'SELECT child_code FROM children')]
        assert len(codes)==len(set(codes))
    with transaction(principal='admin') as c:
        private=one(c,"SELECT personal_information FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['personal_information']
    with transaction('p3','case.read') as c:
        for name in private['name'].values():
            assert name not in ChildPrivacyService(c).text('Observation '+name)
        from datetime import date
        born=date.fromisoformat(private['birthDate'])
        for value in (born.strftime('%d/%m/%Y'),born.strftime('%d-%m-%Y'),born.strftime('%Y/%m/%d'),'22 123 456'):
            assert value not in ChildPrivacyService(c).text('Note '+value)
        assert ChildPrivacyService(c).project({'mode':'demo','generation_method':'manual','validation_status':'approved'})=={'mode':'demo','generation_method':'manual','validation_status':'approved'}
        staff=one(c,"SELECT payload FROM employees WHERE id='p3'")['payload']
        assert ChildPrivacyService(c).project(staff)==staff
        forged={'id':'p3','role':'educator','name':private['name']}
        assert ChildPrivacyService(c).project(forged)['name']!=private['name']


def test_identity_is_explicit_and_scoped(client):
    login(client,'p3')
    assert client.get('/api/v1/cases/CDIS-024/identity').status_code==404
    payload=client.get('/api/v1/workspace').json()
    assert payload['children']
    assert all(ch['name']=={'ar':ch['child_code'],'fr':ch['child_code']} for ch in payload['children'])
    assert 'first_name' not in json.dumps(payload) and 'last_name' not in json.dumps(payload)
    login(client,'p1')
    identity=client.get('/api/v1/cases/CDIS-024/identity')
    assert identity.status_code==200,identity.text
    assert identity.json()['birth_date']
    assert client.get('/api/v1/cases/CDIS-033/identity').status_code==404


def test_new_child_codes_are_opaque_stable_and_reused_by_successive_cases(client):
    login(client,'p1')
    body={'name':{'ar':'هوية اصطناعية '+uuid.uuid4().hex,'fr':'Synthetic identity '+uuid.uuid4().hex},'birthDate':'2013-05-01','gender':'female','source':'Admission fictive de test'}
    result=client.post('/api/v1/cases',json=body)
    assert result.status_code==200,result.text
    value=result.json();code=value['child_code'];case_id=value['id']
    assert re.fullmatch('CH-[A-F0-9]{24}',code)
    assert code not in case_id and len(code)==27
    child=client.get('/api/v1/cases/'+case_id).json()['child']
    assert child['child_code']==code and child['birthDate']==''
    assert client.post('/api/v1/cases/'+case_id+'/successor',json={'reason':'Nouvel accompagnement'}).status_code==409
    with transaction(principal='admin') as c:
        c.execute(text("UPDATE cases SET payload=jsonb_set(payload,'{status}','\"closed\"') WHERE id=:id"),{'id':case_id})
        child_id=one(c,'SELECT child_id FROM cases WHERE id=:id',id=case_id)['child_id']
    try:
        successor=client.post('/api/v1/cases/'+case_id+'/successor',json={'reason':'Nouvel accompagnement successif autorisé'})
        assert successor.status_code==200,successor.text
        assert successor.json()['child_code']==code and successor.json()['id']!=case_id
        with transaction(principal='admin') as c:
            assert one(c,'SELECT count(*) AS n FROM cases WHERE child_id=:id',id=child_id)['n']==2
        assert sum(ch['id']==child_id for ch in client.get('/api/v1/workspace').json()['children'])==1
        with pytest.raises(DBAPIError):
            with transaction(principal='admin') as c:c.execute(text("UPDATE children SET child_code='CDIS-999999' WHERE id=:id"),{'id':child_id})
    finally:
        pass # Test database is isolated and removed by conftest; no live record is reset.


def test_identity_rls_enforces_purpose_and_dedicated_scope(client):
    login(client,'p1')
    for actor,purpose,expected in [('p3','child.identity.read',0),('p1','case.read',0),('p1','child.identity.read',1),('p5','child.identity.read',0)]:
        with transaction(actor,purpose) as c:
            assert one(c,"SELECT count(*) AS n FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['n']==expected
            assert one(c,'SELECT count(*) AS n FROM child_identity_aliases')['n']==0
    login(client,'p3')
    assert client.patch('/api/v1/cases/CDIS-024/identity',json={'changes':{'name':{'ar':'ممنوع','fr':'Forbidden'}}}).status_code==404


def test_old_identity_values_remain_redacted_after_canonical_change(client):
    login(client,'p1')
    path='/api/v1/cases/CDIS-025/identity'
    old=client.get(path).json()['personal_information']['name']
    new={'ar':'هوية معدلة اصطناعية','fr':'Revised synthetic identity'}
    assert client.patch(path,json={'changes':{'name':new}}).status_code==200
    try:
        for name in [*old.values(),*new.values()]:
            with transaction('p1','case.read') as c:assert name not in ChildPrivacyService(c).text('Observation: '+name)
        workspace=client.get('/api/v1/workspace')
        assert all(name not in workspace.text for name in [*old.values(),*new.values()])
        assert client.get('/api/v1/search',params={'q':old['fr']}).json()['results']==[]
        with transaction(principal='admin') as c:
            audit=json.dumps([dict(r) for r in rows(c,'SELECT action,resource_id,metadata FROM audit_events')],default=str)
            assert all(name not in audit for name in [*old.values(),*new.values()])
    finally:
        assert client.patch(path,json={'changes':{'name':old}}).status_code==200


def test_general_sources_exports_and_indexes_contain_no_known_full_names(client):
    login(client,'p2')
    with transaction(principal='admin') as c:
        names=one(c,"SELECT personal_information->'name' AS name FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['name']
    for path in ['/api/v1/workspace','/api/v1/exports/workspace','/api/v1/cases/CDIS-024','/api/v1/cases/CDIS-024/journey','/api/v1/cases/CDIS-024/journey/stages/2','/api/v1/cases/CDIS-024/journey/summaries','/api/v1/groups/group-a/children','/api/v1/search?q=CDIS-024','/api/v1/forum']:
        result=client.get(path)
        assert result.status_code==200,(path,result.text)
        assert all(name not in result.text for name in names.values()),path
        assert result.headers['cache-control']=='no-store'
    from backend.workers.indexer import process_one
    while process_one():pass
    with transaction(principal='worker') as c:
        chunks=' '.join(r['chunk_text'] for r in rows(c,"SELECT chunk_text FROM document_chunks WHERE case_id='CDIS-024'"))
        assert chunks and all(name not in chunks for name in names.values())
    with transaction('p2','forms.read') as c:
        version=one(c,"SELECT v.id FROM document_versions v JOIN protected_originals o ON o.version_id=v.id WHERE case_id='CDIS-024' LIMIT 1")['id']
    source=client.get('/api/v1/document-versions/'+version+'/original')
    assert source.status_code==200 and 'text/plain' in source.headers['content-type']
    assert all(name not in source.text for name in names.values())


def test_exports_print_and_cached_case_urls_recheck_current_rights(client):
    login(client)
    assert client.post('/api/v1/exports/cases',json={'case_ids':['CDIS-024']}).json()['cases'][0]['child_code']=='CDIS-024'
    assert client.post('/api/v1/exports/cases',json={'case_ids':['CDIS-033']}).status_code==404
    assert client.get('/api/v1/cases/CDIS-024/forms/F12/access').status_code==404
    assert client.get('/api/v1/cases/CDIS-024/forms/F02/access').status_code==200
    with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='p3-group-a'"))
    try:
        assert client.post('/api/v1/exports/cases',json={'case_ids':['CDIS-024']}).status_code==404
        assert client.get('/api/v1/exports/workspace').json()['cases']==[]
        assert client.get('/api/v1/cases/CDIS-024/forms/F02/access').status_code==404
        assert client.get('/api/v1/cases/CDIS-024/access').status_code==404
        assert client.get('/api/v1/cases/CDIS-024/journey/summaries').status_code==404
    finally:
        with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignments SET assignment_status='ACTIVE' WHERE id='p3-group-a'"))


def test_search_body_and_access_logs_do_not_expose_identity_urls(client):
    import logging
    login(client)
    result=client.post('/api/v1/search',json={'q':'CDIS-024','category':'case'})
    assert result.status_code==200 and result.json()['results']
    log=logging.LogRecord('uvicorn.access',20,'',0,'%s - "%s %s HTTP/%s" %s',('local','GET','/search?q=confidential-name','1.1',200),None)
    assert PrivacyAccessLogFilter().filter(log)
    assert 'confidential-name' not in log.getMessage() and '/search?' not in log.getMessage()
