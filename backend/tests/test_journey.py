import json
import pytest
from fastapi import HTTPException
from sqlalchemy import text
from backend.authorization import AuthenticatedEmployee
from backend.db import engine, transaction, one, rows
from backend.journey import overview, read_journey, open_document
from .conftest import login


def test_journey_requires_session_and_live_case_authorization(client):
    assert client.get('/api/v1/journeys/assigned').status_code == 401
    assert client.get('/api/v1/cases/CDIS-024/journey').status_code == 401
    login(client)
    assert client.get('/api/v1/cases/CDIS-033/journey', headers={'X-Role': 'administration'}).status_code == 404
    assert client.get('/api/v1/cases/CDIS-033/journey/stages/3').status_code == 404
    assert client.get('/api/v1/cases/missing/journey').status_code == 404
    assert client.get('/api/v1/cases/CDIS-024/journey/stages/6').status_code == 422
    assert client.post('/api/v1/cases/CDIS-024/journey', json={'stage': 5}).status_code == 405


def test_journey_overview_counts_and_lists_have_identical_authorized_sources(client):
    login(client)
    response = client.get('/api/v1/journeys/assigned')
    assert response.status_code == 200, response.text
    data = response.json()
    expected = {c['id'] for c in client.get('/api/v1/workspace').json()['cases']}
    assert {c['id'] for c in data['children']} == expected
    assert data['count'] == 6
    assert sum(s['childCount'] for s in data['checkpoints']) == data['count']
    assert all(s['childCount'] == sum(ch['stage'] == s['id'] for ch in data['children']) for s in data['checkpoints'])
    assert client.get('/api/v1/journeys/assigned?group_id=group-a').json()['count'] == 6
    assert client.get('/api/v1/journeys/assigned?group_id=group-b').status_code == 404
    assert client.get('/api/v1/journeys/assigned?q=CDIS-024').json()['count'] == 1
    assert client.get('/api/v1/journeys/assigned?q=CDIS-035').json()['count'] == 0
    assert not any(key in json.dumps(data) for key in ('birthDate', 'address', 'phone', 'longitude', 'latitude'))


def test_individual_projection_matches_case_and_never_invents_dates_or_achievements(client):
    login(client)
    response = client.get('/api/v1/cases/CDIS-024/journey')
    assert response.status_code == 200, response.text
    journey = response.json()
    case = next(c for c in client.get('/api/v1/workspace').json()['cases'] if c['id'] == 'CDIS-024')
    assert journey['stage'] == case['stage'] == 3
    assert len(journey['checkpoints']) == 5
    assert [s['id'] for s in journey['checkpoints'] if s['current']] == [3]
    assert all(s['future'] for s in journey['checkpoints'][3:])
    assert journey['checkpoints'][0]['startedAt'] == case['openedAt']
    assert all(s['endedAt'] is None for s in journey['checkpoints'])
    assert journey['metrics']['goalsAchieved'] is None
    assert journey['metrics']['goalsInProgress'] is None
    assert all(s['completedSubsteps'] <= s['totalSubsteps'] for s in journey['checkpoints'])
    assert all('substeps' not in s and 'events' not in s and 'documents' not in s for s in journey['checkpoints'])
    assert not any(key in journey['child'] for key in ('address', 'phone', 'birthDate', 'school'))
    assert 'score' not in journey['metrics'] and 'risk' not in journey['metrics']


def test_confidential_documents_and_versions_are_filtered_before_delivery(client):
    login(client)
    educator = client.get('/api/v1/cases/CDIS-024/journey').json()
    stage = client.get('/api/v1/cases/CDIS-024/journey/stages/2')
    assert stage.status_code == 200, stage.text
    assert not any(d['formId'] == 'F12' for d in stage.json()['checkpoint']['documents'])
    assert not any(f['id'] == 'F12' for f in stage.json()['forms'])
    assert not any(c['formId'] == 'F12' for c in educator['comparisons'])
    assert sum(c['formId'] == 'F08' for c in educator['comparisons']) >= 2
    login(client, 'p2')
    psychologist = client.get('/api/v1/cases/CDIS-024/journey').json()
    assert any(c['formId'] == 'F12' for c in psychologist['comparisons'])
    login(client, 'p6')
    limited = client.get('/api/v1/cases/CDIS-024/journey').json()
    assert not limited['comparisons']
    limited_stage = client.get('/api/v1/cases/CDIS-024/journey/stages/3').json()['checkpoint']
    # The limited profile legitimately keeps roadmap.read; never turn UI assumptions into policy.
    assert all(d['formId'] in ('F13', 'F14') for d in limited_stage['documents'])
    assert all(s['documentCount'] == 0 for s in limited['checkpoints'][:2])


def test_document_open_rechecks_case_and_record_scope(client):
    login(client, 'p2')
    docs = client.get('/api/v1/cases/CDIS-024/journey/stages/2').json()['checkpoint']['documents']
    private = next(d for d in docs if d['formId'] == 'F12')
    assert client.get(f"/api/v1/cases/CDIS-024/journey/documents/{private['id']}/open").status_code == 200
    login(client)
    assert client.get(f"/api/v1/cases/CDIS-024/journey/documents/{private['id']}/open").status_code == 404
    public = next(d for d in docs if d['formId'] == 'F08')
    assert client.get(f"/api/v1/cases/CDIS-024/journey/documents/{public['id']}/open").json()['path'] == public['path']
    assert client.get(f"/api/v1/cases/CDIS-033/journey/documents/{public['id']}/open").status_code == 404


@pytest.mark.parametrize('change', [
    "UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='p3-group-a'",
    "UPDATE group_assignment_scopes SET revoked_at=now() WHERE group_assignment_id='p3-group-a' AND scope_code='general.read'",
    "UPDATE employee_centres SET active=false WHERE employee_id='p3'",
])
def test_revocation_immediately_removes_overview_stage_and_document(client, change):
    login(client)
    employee = AuthenticatedEmployee('p3', client.get('/api/v1/me').json()['sessionId'])
    with engine('admin').connect() as c:
        tx = c.begin()
        try:
            version = one(c, "SELECT id FROM document_versions WHERE case_id='CDIS-024' AND form_id='F08' LIMIT 1")['id']
            c.execute(text(change))
            c.exec_driver_sql('SET LOCAL ROLE masar_app')
            c.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','case.read',true)"))
            assert not overview(c, employee)['children']
            with pytest.raises(HTTPException) as refused:
                read_journey(c, employee, 'CDIS-024', 2)
            assert refused.value.status_code == 404
            with pytest.raises(HTTPException):
                open_document(c, employee, 'CDIS-024', version)
        finally:
            tx.rollback()


def test_membership_change_recalculates_counts_without_exposing_removed_child(client):
    login(client)
    employee = AuthenticatedEmployee('p3', client.get('/api/v1/me').json()['sessionId'])
    with engine('admin').connect() as c:
        tx = c.begin()
        try:
            c.execute(text("UPDATE child_group_memberships SET membership_status='ENDED',valid_to=now() WHERE group_id='group-a' AND case_id='CDIS-024'"))
            c.exec_driver_sql('SET LOCAL ROLE masar_app')
            c.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','case.read',true)"))
            data = overview(c, employee)
            assert data['count'] == 5
            assert sum(s['childCount'] for s in data['checkpoints']) == 5
            assert all(ch['id'] != 'CDIS-024' for ch in data['children'])
        finally:
            tx.rollback()


def test_journey_refreshes_after_official_write_without_mutating_workflow(client):
    login(client)
    before = client.get('/api/v1/cases/CDIS-024/journey').json()
    note = 'ملاحظة اصطناعية عن المشاركة. Observation de démonstration.'
    written = client.post('/api/v1/cases/CDIS-024/observations', json={'note': note, 'category': 'educational'})
    assert written.status_code == 200
    from backend.privacy import ChildPrivacyService
    with transaction('p3','case.read') as c:visible_note=ChildPrivacyService(c).text(note)
    with transaction(principal='admin') as c:
        assert one(c,"SELECT payload->>'note' AS note FROM observations WHERE id=:id",id=written.json()['id'])['note']==note
    after = client.get('/api/v1/cases/CDIS-024/journey').json()
    assert any(e['note'] == visible_note for e in after['events'])
    assert after['stage'] == before['stage'] and after['cycle'] == before['cycle']
    assert after['versions'] == before['versions']
    stage = client.get('/api/v1/cases/CDIS-024/journey/stages/3').json()['checkpoint']
    assert any(e['note'] == visible_note for e in stage['events'])


def test_synthetic_extension_conserves_prior_versions_and_is_idempotent(client):
    login(client)
    response = client.get('/api/v1/cases/CDIS-014/journey')
    assert response.status_code == 200, response.text
    data = response.json()
    assert data['cycle'] == 2 and data['stage'] == 3
    assert [v['version'] for v in data['versions']] == [1, 2]
    assert len(data['cycles']) == 2
    decision = data['cycles'][1]['decisions'][0]
    assert decision['kind'] == 'extend' and decision['from'] == 4 and decision['to'] == 3
    assert decision['historicalDemo'] and decision['reason']
    from backend.journey.demo import prepare_journey_demo
    prepare_journey_demo()
    again = client.get('/api/v1/cases/CDIS-014/journey').json()
    assert again['versions'] == data['versions'] and again['cycles'] == data['cycles']


def test_journey_audit_contains_no_narrative(client):
    login(client)
    client.get('/api/v1/cases/CDIS-024/journey')
    client.get('/api/v1/cases/CDIS-024/journey/stages/3')
    with transaction(principal='admin') as c:
        metadata = rows(c, "SELECT metadata FROM audit_events WHERE action LIKE 'journey.%'")
        assert metadata and all(set(r['metadata']).issubset({'stage'}) for r in metadata)


def test_readable_event_cannot_leak_its_confidential_source(client):
    login(client)
    employee = AuthenticatedEmployee('p3', client.get('/api/v1/me').json()['sessionId'])
    with engine('admin').connect() as c:
        tx = c.begin()
        try:
            from backend.seed import record
            version = one(c, "SELECT id FROM document_versions WHERE case_id='CDIS-024' AND form_id='F12' LIMIT 1")['id']
            record(c, 'intervention_events', 'journey-confidential-source-test', 'CDIS-024',
                   {'type': 'observation', 'stage': 2, 'sourceId': version, 'note': 'PRIVATE_SOURCE_SENTINEL'},
                   'educational', 'p3', source=version)
            c.exec_driver_sql('SET LOCAL ROLE masar_app')
            c.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','case.read',true)"))
            result = read_journey(c, employee, 'CDIS-024')
            assert 'PRIVATE_SOURCE_SENTINEL' not in json.dumps(result)
            assert not any(e['id'] == 'journey-confidential-source-test' for e in result['events'])
        finally:
            tx.rollback()


def test_original_orientation_is_preserved_without_closing_the_case(client):
    from backend.config import ROOT
    from backend.journey.demo import preserve_historical_integrations
    source = next(i for i in json.loads((ROOT/'database/seed_data/demo.json').read_text(encoding='utf-8'))['data']['integrations'] if i['caseId'] == 'CDIS-006')
    login(client, 'p2')
    data = client.get('/api/v1/cases/CDIS-006/journey').json()
    assert data['stage'] == 5 and data['caseStatus'] == 'active'
    orientation = next(e for e in data['events'] if e['id'] == source['id'])
    assert orientation['type'] == 'integration' and orientation['note'] == source['notes']
    details = client.get('/api/v1/cases/CDIS-006/journey/stages/5').json()
    assert details['checkpoint']['future'] and details['checkpoint']['current']
    if source['result']:
        assert any(r['text'] == source['result'] for r in details['results'])
    preserve_historical_integrations()
    again = client.get('/api/v1/cases/CDIS-006/journey').json()
    assert sum(e['id'] == source['id'] for e in again['events']) == 1
    assert again['caseStatus'] == 'active' and again['stage'] == 5
