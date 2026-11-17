"""Workplace selection is context, never a source of permissions."""
import json
from fastapi import HTTPException
from ..config import settings,ROOT
from ..db import rows,one
from ..authorization import AuthorizationService
from ..events import audit

REFERENCE_GOVERNORATES=json.loads((ROOT/'config/governorates.json').read_text(encoding='utf-8'))

def preserve_governorate_labels(original,projected):
    """Restore only exact public reference labels, never caller-supplied narrative."""
    known={g['id']:g['name'] for g in REFERENCE_GOVERNORATES}
    if isinstance(original,list) and isinstance(projected,list) and len(original)==len(projected):
        for source,target in zip(original,projected):
            if isinstance(source,dict) and isinstance(target,dict) and set(source)=={'id','name'} and source.get('name')==known.get(source.get('id')):
                target['name']=known[source['id']]
    return projected

def centre_dto(row):
    return {'id':row['id'],'name':row['payload']['name'],'region':row['governorate_name'],
            'governorateId':row['governorate_id'],'isDemo':row['is_demo']}

def governorates(c):
    return [dict(r) for r in rows(c,'SELECT id,name FROM governorates ORDER BY id')]

def public_centres(c,governorate_id):
    if not one(c,'SELECT id FROM governorates WHERE id=:id',id=governorate_id):
        raise HTTPException(404,detail={'code':'GOVERNORATE_UNAVAILABLE'})
    if settings.identity_mode!='demo':return []
    return [centre_dto(r) for r in rows(c,'''SELECT c.*,g.name AS governorate_name FROM centres c JOIN governorates g ON g.id=c.governorate_id
        WHERE c.governorate_id=:id AND c.active AND c.is_demo ORDER BY c.id''',id=governorate_id)]

def demo_profiles(c,governorate_id,centre_id):
    if settings.identity_mode!='demo':raise HTTPException(403,detail={'code':'DEMO_DISABLED'})
    return [r['payload'] for r in rows(c,'SELECT * FROM authz.demo_entry_profiles(:governorate,:centre)',governorate=governorate_id,centre=centre_id)]

def authorized_centres(c,employee_id):
    return [centre_dto(r) for r in rows(c,'''SELECT c.*,g.name AS governorate_name FROM centres c JOIN governorates g ON g.id=c.governorate_id
        WHERE authz.entry_centre_allowed(:employee,c.id) ORDER BY c.id''',employee=employee_id)]

def select_centre(c,employee,governorate_id,centre_id):
    AuthorizationService(c,employee).require_active_session()
    ok=one(c,'SELECT authz.set_entry_centre(CAST(:session AS uuid),:employee,:centre,:governorate) AS ok',
        session=employee.session_id,employee=employee.employee_id,centre=centre_id,governorate=governorate_id)['ok']
    if not ok:raise HTTPException(403,detail={'code':'WORKPLACE_MISMATCH'})
    audit(c,employee.employee_id,'session.centre.select','centre',centre_id)
    return {'selectedCentreId':centre_id}
