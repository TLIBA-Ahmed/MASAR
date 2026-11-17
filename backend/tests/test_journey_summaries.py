import json,uuid
from dataclasses import replace
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from backend.db import transaction,one,rows
from backend.ai_client import LocalModelError
from .conftest import login

BASE='/api/v1/cases/CDIS-024/journey/summaries'

def generate(client,stage=3,**body):
    result=client.post(BASE+'/stages/'+str(stage),json=body)
    assert result.status_code==200,result.text
    return result.json()

def test_five_stage_specific_previews_are_pseudonymous_and_future_is_pending(client):
    login(client)
    response=client.get(BASE)
    assert response.status_code==200,response.text
    value=response.json()
    assert value['child_code']=='CDIS-024'
    assert [s['stage_id'] for s in value['stages']]==[1,2,3,4,5]
    stage3=value['stages'][2]['summary']
    assert stage3['source_references'] and stage3['sections']['objectives']
    for s in value['stages'][3:]:
        assert not s['summary']['source_references']
        assert not s['summary']['sections']['progress'] and not s['summary']['sections']['decisions']
        assert 'non commencée' in s['summary']['summary_fr']
    assert all(s['summary']['validation_status']=='preview' for s in value['stages'])
    login(client,'p6')
    limited=client.get(BASE).json()
    assert not limited['permissions']['generate']
    assert client.post(BASE+'/stages/3',json={}).status_code==404
    assert client.get('/api/v1/cases/CDIS-033/journey/summaries').status_code==404

def test_snapshot_review_and_versions_are_immutable(client):
    login(client)
    draft=generate(client)
    assert draft['generation_method']=='deterministic_demo' and draft['validation_status']=='draft'
    assert draft['validated_by'] is None and draft['model_version'] is None
    assert client.get(BASE).json()['stages'][2]['summary']['validation_status']!='approved'
    reviewed=client.post(BASE+'/'+draft['id']+'/review',json={'status':'approved','reason':'Sources relues et faits vérifiés.'})
    assert reviewed.status_code==200,reviewed.text
    assert reviewed.json()['validated_by']=='p3' and reviewed.json()['validated_at']
    assert client.get(BASE).json()['stages'][2]['summary']['id']==draft['id']
    assert client.post(BASE+'/'+draft['id']+'/review',json={'status':'rejected','reason':'Deuxième revue'}).status_code==409
    newer=generate(client)
    assert newer['version']==draft['version']+1
    history=client.get(BASE+'/stages/3/history').json()['versions']
    assert next(v for v in history if v['id']==draft['id'])['summary_fr']==draft['summary_fr']
    with pytest.raises(DBAPIError):
        with transaction(principal='admin') as c:c.execute(text("UPDATE journey_stage_summaries SET summary_fr='changed' WHERE id=:id"),{'id':draft['id']})

def test_new_evidence_marks_approved_snapshot_outdated_without_overwrite(client):
    login(client)
    draft=generate(client)
    assert client.post(BASE+'/'+draft['id']+'/review',json={'status':'approved','reason':'Relecture professionnelle documentée'}).status_code==200
    observation=client.post('/api/v1/cases/CDIS-024/observations',json={'note':'Nouvelle observation synthétique '+uuid.uuid4().hex,'category':'educational'})
    assert observation.status_code==200
    cards=client.get(BASE).json()['stages'][2]
    assert cards['summary']['id']==draft['id'] and cards['update_available']
    newer=generate(client)
    assert newer['version']>draft['version']
    assert client.post(BASE+'/'+newer['id']+'/review',json={'status':'approved','reason':'Actualisation relue et validée'}).status_code==200

def test_local_gateway_receives_only_authorized_pseudonymous_context_and_sources(client,monkeypatch):
    from backend.journey import summary_generator
    login(client)
    with transaction(principal='admin') as c:
        names=one(c,"SELECT personal_information->'name' AS names FROM child_identities WHERE child_id=(SELECT child_id FROM cases WHERE id='CDIS-024')")['names']
    observed=[]
    def local(path,body):
        serialized=json.dumps(body,ensure_ascii=False)
        assert all(n not in serialized for n in names.values())
        assert 'F12' not in serialized
        option=body['evidence_options'][0];observed.append(body)
        return {'result':{'answer':option['text'],'source_ids':[option['source_id']]},'model_revision':'qwen3-test-revision'}
    monkeypatch.setattr(summary_generator,'settings',replace(summary_generator.settings,ai_mode='local'))
    monkeypatch.setattr(summary_generator.gateway,'request',local)
    draft=generate(client)
    assert draft['generation_method']=='ai' and draft['model_version']=='qwen3-test-revision'
    assert len(observed)==2
    def unavailable(*args):raise LocalModelError('UNAVAILABLE')
    monkeypatch.setattr(summary_generator.gateway,'request',unavailable)
    assert generate(client)['generation_method']=='deterministic_unavailable'
    monkeypatch.setattr(summary_generator.gateway,'request',lambda *a:{'result':{'answer':'Invented progress','source_ids':['S1']}})
    assert generate(client)['generation_method']=='deterministic_invalid_output'

def test_summary_sources_are_reauthorized_after_scope_revocation(client):
    login(client,'p2')
    draft=generate(client,stage=2)
    assert any('F12' in json.dumps(ref) for ref in draft['source_references'])
    login(client,'p3')
    assert client.get(BASE+'/stages/2/sources?summary_id='+draft['id']).status_code==404
    login(client,'p2')
    with transaction(principal='admin') as c:
        c.execute(text("UPDATE group_assignment_scopes SET revoked_at=now() WHERE group_assignment_id='p2-group-a' AND scope_code='psychological.read'"))
    try:
        assert client.get(BASE+'/stages/2/sources?summary_id='+draft['id']).status_code==404
        assert not any(v['id']==draft['id'] for v in client.get(BASE+'/stages/2/history').json()['versions'])
        assert client.post(BASE+'/'+draft['id']+'/review',json={'status':'approved','reason':'Tentative hors scope'}).status_code==404
    finally:
        with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignment_scopes SET revoked_at=NULL WHERE group_assignment_id='p2-group-a' AND scope_code='psychological.read'"))

def test_cycles_and_idor_source_navigation(client):
    login(client)
    endpoint='/api/v1/cases/CDIS-014/journey/summaries'
    value=client.get(endpoint).json()
    assert value['stages'][2]['cycle_id']==2
    old=client.post(endpoint+'/stages/3',json={'cycle_id':1})
    assert old.status_code==200,old.text
    current=client.post(endpoint+'/stages/3',json={'cycle_id':2})
    assert current.status_code==200,current.text
    assert old.json()['cycle_id']!=current.json()['cycle_id']
    assert old.json()['id']!=current.json()['id']
    future=client.post(endpoint+'/stages/5',json={'cycle_id':1})
    assert future.status_code==200
    assert not future.json()['source_references'] and 'non commencée' in future.json()['summary_fr']
    assert client.get(BASE+'/stages/3/sources?summary_id='+current.json()['id']).status_code==404
    assert client.get(BASE+'/stages/3/sources?source_kind=document_versions&source_id=FORGED').status_code==404


def test_context_and_access_are_rechecked_after_slow_inference(client,monkeypatch):
    from backend.journey.summary_generator import StageSummaryGenerator
    from backend.seed import record
    login(client)
    original=StageSummaryGenerator.generate
    with transaction(principal='admin') as c:before=one(c,'SELECT count(*) AS n FROM journey_stage_summaries')['n']
    def concurrent_change(generator,context,manual=None):
        with transaction(principal='admin') as c:
            record(c,'observations','concurrent-'+uuid.uuid4().hex,'CDIS-024',{'note':'Observation nouvelle pendant le traitement','stage':3},'educational','p3')
        return original(generator,context,manual)
    monkeypatch.setattr(StageSummaryGenerator,'generate',concurrent_change)
    assert client.post(BASE+'/stages/3',json={}).status_code==409
    with transaction(principal='admin') as c:assert one(c,'SELECT count(*) AS n FROM journey_stage_summaries')['n']==before
    def concurrent_revoke(generator,context,manual=None):
        with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignment_scopes SET revoked_at=now() WHERE group_assignment_id='p3-group-a' AND scope_code='journey.summary.generate'"))
        return original(generator,context,manual)
    monkeypatch.setattr(StageSummaryGenerator,'generate',concurrent_revoke)
    try:assert client.post(BASE+'/stages/3',json={}).status_code==404
    finally:
        with transaction(principal='admin') as c:c.execute(text("UPDATE group_assignment_scopes SET revoked_at=NULL WHERE group_assignment_id='p3-group-a' AND scope_code='journey.summary.generate'"))


def test_database_rejects_forged_summary_sources_and_manual_future_results(client):
    login(client)
    draft=generate(client)
    with pytest.raises(DBAPIError):
        with transaction('p3','journey.summary.generate') as c:
            c.execute(text("""INSERT INTO journey_stage_summaries(id,case_id,stage_id,cycle_id,summary_ar,summary_fr,sections,period,source_references,context_fingerprint,generation_method,version,created_by)
             SELECT :new,case_id,stage_id,cycle_id,summary_ar,summary_fr,sections,period,'[{"kind":"document_versions","id":"forbidden"}]',context_fingerprint,generation_method,9999,'p3'
             FROM journey_stage_summaries WHERE id=:id"""),{'new':'forged-'+uuid.uuid4().hex,'id':draft['id']})
    assert client.post(BASE+'/stages/5',json={'manual':{'ar':'نتيجة مستقبلية','fr':'Résultat futur'}}).status_code==422
