from dataclasses import replace
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from backend.db import transaction, rows, one, engine
from backend.authorization import Purpose
from .conftest import login


def test_forum_preserves_narratives_and_server_identity(client):
    login(client)
    body = '  مورد مهني عام\nRessource de démonstration, sans donnée individuelle.  '
    response = client.post('/api/v1/forum/posts', json={'body': body})
    assert response.status_code == 200, response.text
    post_id = response.json()['id']
    post = next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id'] == post_id)
    assert post['body'] == body and post['authorId'] == 'p3'
    assert post in client.get('/api/v1/workspace').json()['posts']
    assert client.post('/api/v1/forum/posts', json={'body': body, 'authorId': 'p4'}).status_code == 422
    assert client.post('/api/v1/forum/posts', json={'body': '  \n  '}).status_code == 422
    assert client.post('/api/v1/forum/posts', json={'body': 'x'*10001}).status_code == 422

    login(client, 'p2')
    comment = '  تعليق عام محفوظ كما أُدخل.  '
    assert client.post(f'/api/v1/forum/posts/{post_id}/comments', json={'body': comment}).status_code == 200
    post = next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id'] == post_id)
    assert post['comments'][-1]['body'] == comment
    assert post['comments'][-1]['authorId'] == 'p2'
    with transaction(principal='admin') as c:
        events = rows(c, "SELECT metadata FROM audit_events WHERE action LIKE 'forum.%' AND resource_id=:id", id=post_id)
        assert events and all(not r['metadata'] for r in events)


def test_forum_reactions_are_idempotent_and_favorites_are_personal(client):
    login(client)
    post_id = client.post('/api/v1/forum/posts', json={'body': 'Ressource générale de démonstration.'}).json()['id']
    for _ in range(2):
        assert client.put(f'/api/v1/forum/posts/{post_id}/reaction', json={'active': True}).status_code == 200
        assert client.put(f'/api/v1/forum/posts/{post_id}/favorite', json={'active': True}).status_code == 200
    post = next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id'] == post_id)
    assert post['likes'] == ['p3'] and post['favorite']
    login(client, 'p2')
    post = next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id'] == post_id)
    assert post['likes'] == ['p3'] and not post['favorite']
    login(client)
    assert client.put(f'/api/v1/forum/posts/{post_id}/reaction', json={'active': False}).status_code == 200
    assert client.put(f'/api/v1/forum/posts/{post_id}/favorite', json={'active': False}).status_code == 200
    post = next(p for p in client.get('/api/v1/forum').json()['posts'] if p['id'] == post_id)
    assert not post['likes'] and not post['favorite']


def test_forum_messages_require_membership_and_cross_centre_is_denied(client):
    login(client)
    body = '  Ressource générale pour la réunion fictive.  '
    assert client.post('/api/v1/forum/conversations/conv-1/messages', json={'body': body}).status_code == 200
    conversation = client.get('/api/v1/forum').json()['conversations'][0]
    assert conversation['messages'][-1]['body'] == body
    assert conversation['messages'][-1]['authorId'] == 'p3'
    assert client.post('/api/v1/forum/conversations/conv-2/messages', json={'body': body}).status_code == 404
    login(client, 'p6')
    assert not client.get('/api/v1/forum').json()['conversations']
    assert client.post('/api/v1/forum/conversations/conv-1/messages', json={'body': body}).status_code == 404
    login(client, 'p5')
    assert client.get('/api/v1/forum').json() == {'posts': [], 'conversations': []}
    assert client.post('/api/v1/forum/posts/post-1/comments', json={'body': body}).status_code == 404
    assert client.put('/api/v1/forum/posts/post-1/favorite', json={'active': True}).status_code == 404
    assert client.put('/api/v1/forum/posts/post-1/reaction', json={'active': True}).status_code == 404
    assert client.post('/api/v1/forum/conversations/conv-1/messages', json={'body': body}).status_code == 404
    assert client.post('/api/v1/forum/posts/missing/comments', json={'body': body}).status_code == 404


@pytest.mark.parametrize('employee,purpose', [(None, Purpose.FORUM_READ), ('p3', 'case.read'), ('p3', 'unknown')])
def test_forum_rls_deny_by_default(employee, purpose):
    with transaction(employee, purpose) as c:
        assert not rows(c, 'SELECT id FROM forum_posts')
        assert not rows(c, 'SELECT id FROM forum_conversations')
        assert not rows(c, 'SELECT post_id FROM forum_favorites')


@pytest.mark.parametrize('change', [
    "UPDATE group_assignments SET assignment_status='REVOKED' WHERE id='p3-group-a'",
    "UPDATE group_assignment_scopes SET revoked_at=now() WHERE group_assignment_id='p3-group-a' AND scope_code='general.read'",
    "UPDATE employee_centres SET active=false WHERE employee_id='p3'",
    "DELETE FROM role_permissions WHERE role_id='educator' AND permission='forum.read'",
    "UPDATE forum_conversations SET members=ARRAY['p1','p2','p4'] WHERE id='conv-1'",
])
def test_forum_revocation_is_immediate(change):
    with engine('admin').connect() as c:
        tx = c.begin()
        try:
            c.execute(text(change))
            c.exec_driver_sql('SET LOCAL ROLE masar_app')
            c.execute(text("SELECT set_config('masar.employee_id','p3',true),set_config('masar.purpose','forum.read',true)"))
            assert not rows(c, 'SELECT id FROM forum_conversations')
            if 'members=' not in change:
                assert not rows(c, 'SELECT id FROM forum_posts')
        finally:
            tx.rollback()


def test_forum_forced_rls_and_identity_columns_are_protected():
    with transaction('p3', Purpose.FORUM_READ) as c:
        assert all(r['relforcerowsecurity'] for r in rows(c,
            "SELECT relforcerowsecurity FROM pg_class WHERE relname IN ('forum_posts','forum_favorites','forum_conversations')"))
        assert one(c, 'SELECT id FROM forum_posts LIMIT 1')
    with pytest.raises(DBAPIError):
        with transaction('p3', Purpose.FORUM_WRITE) as c:
            c.execute(text("UPDATE forum_posts SET author_id='p3' WHERE id='post-2'"))
    with pytest.raises(DBAPIError):
        with transaction('p3', Purpose.FORUM_WRITE) as c:
            c.execute(text("UPDATE forum_conversations SET members=ARRAY['p3'] WHERE id='conv-2'"))


def test_forum_requires_session_csrf_and_feature_flag(client, monkeypatch):
    assert client.get('/api/v1/forum').status_code == 401
    login(client)
    csrf = client.headers.pop('X-Masar-CSRF')
    assert client.post('/api/v1/forum/posts', json={'body': 'Exemple général.'}).status_code == 403
    client.headers['X-Masar-CSRF'] = csrf
    import backend.forum as forum
    monkeypatch.setattr(forum, 'settings', replace(forum.settings, professional_network=False))
    assert client.get('/api/v1/forum').status_code == 404
    assert client.post('/api/v1/forum/posts', json={'body': 'Exemple général.'}).status_code == 404
