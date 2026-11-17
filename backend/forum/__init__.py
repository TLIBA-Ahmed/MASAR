"""General professional exchanges. Authors, membership and scope are server-owned."""
import json
import uuid
from datetime import datetime, timezone
from fastapi import HTTPException
from sqlalchemy import text
from ..authorization import AuthorizationService
from ..config import settings
from ..db import one, rows
from ..events import audit


def require_enabled():
    if not settings.professional_network:
        raise HTTPException(404, detail={'code': 'RESOURCE_UNAVAILABLE'})


def require_access(c, employee, centre=None, operation='read'):
    require_enabled()
    policy = AuthorizationService(c, employee)
    policy.require_active_session()
    if centre is None:
        centre = next((r['centre_id'] for r in rows(c,
            'SELECT centre_id FROM employee_centres WHERE employee_id=:e AND active ORDER BY centre_id',
            e=employee.employee_id) if one(c,
            'SELECT authz.forum_allowed(:centre,:operation) AS ok',
            centre=r['centre_id'], operation=operation)['ok']), None)
    if not centre or not one(c, 'SELECT authz.forum_allowed(:centre,:operation) AS ok',
                            centre=centre, operation=operation)['ok']:
        policy.deny('forum')
    return centre


def snapshot(c, employee):
    require_enabled()
    AuthorizationService(c, employee).require_active_session()
    posts = [{**r['payload'], 'favorite': bool(r['favorite'])} for r in rows(c, '''
        SELECT p.payload,f.active AS favorite FROM forum_posts p
        LEFT JOIN forum_favorites f ON f.post_id=p.id AND f.employee_id=:e
        ORDER BY p.created_at DESC,p.id DESC''', e=employee.employee_id)]
    conversations = [dict(r['payload'], members=list(r['members'])) for r in rows(c,
        'SELECT payload,members FROM forum_conversations ORDER BY id')]
    # Metadata only; neither storage paths nor raw files enter the workspace.
    attachments={}
    for item in rows(c,'SELECT id,entry_id,filename,media_type,byte_size FROM forum_attachments ORDER BY created_at,id'):
        attachments.setdefault(item['entry_id'],[]).append(dict(id=item['id'],name=item['filename'],mediaType=item['media_type'],size=item['byte_size']))
    for post in posts:
        post['attachments']=attachments.get(post['id'],[])
        for comment in post['comments']:comment['attachments']=attachments.get(comment['id'],[])
    for conversation in conversations:
        for message in conversation['messages']:message['attachments']=attachments.get(message['id'],[])
    return {'posts': posts, 'conversations': conversations}


def content(body,allow_empty=False):
    if (not body.strip() and not allow_empty) or len(body) > 10000:
        raise HTTPException(422, detail={'code': 'INVALID_BUSINESS_VALUE'})
    return body  # Preserve narratives exactly as entered, in either language.


def entry(employee, body, prefix,allow_empty=False):
    return {'id': prefix+'-'+uuid.uuid4().hex, 'authorId': employee.employee_id,
            'body': content(body,allow_empty), 'date': datetime.now(timezone.utc).isoformat()}


def create_post(c, employee, body,has_attachments=False):
    centre = require_access(c, employee, operation='write')
    post = {**entry(employee, body, 'post',has_attachments),
            'category': {'ar': 'مشاركة مهنية', 'fr': 'Partage professionnel'},
            'likes': [], 'comments': []}
    c.execute(text('''INSERT INTO forum_posts(id,centre_id,author_id,payload)
        VALUES(:id,:centre,:author,CAST(:payload AS jsonb))'''),
        {'id': post['id'], 'centre': centre, 'author': employee.employee_id,
         'payload': json.dumps(post, ensure_ascii=False)})
    audit(c, employee.employee_id, 'forum.post.create', 'forum_post', post['id'])
    return {'id': post['id']}


def change_post(c, employee, post_id, action, body=None, active=None,has_attachments=False):
    require_enabled()
    AuthorizationService(c, employee).require_active_session()
    # Serialize append/reaction commands to preserve concurrent contributions.
    row = one(c, 'SELECT centre_id,payload FROM forum_posts WHERE id=:id FOR UPDATE', id=post_id)
    if not row:
        AuthorizationService(c, employee).deny('forum_post')
    require_access(c, employee, row['centre_id'], 'write')
    post = dict(row['payload'])
    if action == 'comment':
        post['comments'].append(entry(employee, body, 'comment',has_attachments))
    elif action == 'reaction':
        post['likes'] = [e for e in post['likes'] if e != employee.employee_id]
        if active:
            post['likes'].append(employee.employee_id)
    elif action == 'favorite':
        c.execute(text('''INSERT INTO forum_favorites(post_id,employee_id,active) VALUES(:id,:e,:active)
            ON CONFLICT(post_id,employee_id) DO UPDATE SET active=EXCLUDED.active'''),
            {'id': post_id, 'e': employee.employee_id, 'active': active})
    else:
        raise ValueError('Unknown forum command')
    if action != 'favorite':
        c.execute(text('UPDATE forum_posts SET payload=CAST(:payload AS jsonb) WHERE id=:id'),
                  {'id': post_id, 'payload': json.dumps(post, ensure_ascii=False)})
    audit(c, employee.employee_id, 'forum.post.'+action, 'forum_post', post_id)
    return {'id': post_id,**({'entry_id':post['comments'][-1]['id']} if action=='comment' else {})}


def send_message(c, employee, conversation_id, body,has_attachments=False):
    require_enabled()
    AuthorizationService(c, employee).require_active_session()
    row = one(c, '''SELECT centre_id,payload FROM forum_conversations
        WHERE id=:id FOR UPDATE''', id=conversation_id)
    if not row:
        AuthorizationService(c, employee).deny('forum_conversation')
    require_access(c, employee, row['centre_id'], 'write')
    conversation = dict(row['payload'])
    conversation['messages'].append(entry(employee, body, 'message',has_attachments))
    c.execute(text('UPDATE forum_conversations SET payload=CAST(:payload AS jsonb) WHERE id=:id'),
              {'id': conversation_id, 'payload': json.dumps(conversation, ensure_ascii=False)})
    audit(c, employee.employee_id, 'forum.message.create', 'forum_conversation', conversation_id)
    return {'id': conversation_id,'entry_id':conversation['messages'][-1]['id']}


def seed_forum():
    """Add the preserved synthetic examples once; never reset existing exchanges."""
    if settings.identity_mode != 'demo':
        return
    from ..config import ROOT
    from ..db import engine
    from ..seed import insert
    data = json.loads((ROOT/'database/seed_data/demo.json').read_text(encoding='utf-8'))['data']
    centres = {p['id']: p['centerId'] for p in data['professionals']}
    with engine('admin').begin() as c:
        for original in data['posts']:
            post = {k: v for k, v in original.items() if k != 'favorite'}
            insert(c, 'forum_posts', {'id': post['id'], 'centre_id': centres[post['authorId']],
                   'author_id': post['authorId'], 'payload': post, 'created_at': post['date']})
        for conversation in data['conversations']:
            if len({centres[m] for m in conversation['members']}) == 1:
                # text[] is bound explicitly; payload never controls membership.
                c.execute(text('''INSERT INTO forum_conversations(id,centre_id,members,payload)
                    VALUES(:id,:centre,:members,CAST(:payload AS jsonb)) ON CONFLICT DO NOTHING'''),
                    {'id': conversation['id'], 'centre': centres[conversation['members'][0]],
                     'members': conversation['members'],
                     'payload': json.dumps({k: v for k, v in conversation.items() if k != 'members'}, ensure_ascii=False)})
