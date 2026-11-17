"""Canonical case projections and explicit, authorized business mutations."""
import hashlib,json,uuid
from datetime import date,datetime,timezone,timedelta
from fastapi import HTTPException
from sqlalchemy import text
from ..db import rows,one
from ..authorization import AuthorizationService
from ..events import audit,publish
from ..seed import record,insert,form_category
from ..config import settings
from ..privacy import ChildPrivacyService,ChildIdentityService,ChildSummaryDTO
from dataclasses import asdict

def now():return datetime.now(timezone.utc).isoformat()
def uid(prefix):return prefix+'-'+uuid.uuid4().hex
def bi(ar,fr):return {'ar':ar,'fr':fr}
def error(code,status=422):raise HTTPException(status,detail={'code':code})
def payloads(c,table):return [r['payload'] for r in rows(c,f'SELECT payload FROM {table} ORDER BY id')]

def workspace(c,e):
    policy=AuthorizationService(c,e)
    cases=[];child_projections={};access={};templates={}
    for row in rows(c,'SELECT ca.id,ca.child_id,ca.payload,ch.payload AS child,ch.child_code FROM cases ca JOIN children ch ON ch.id=ca.child_id ORDER BY ca.id'):
        case=dict(row['payload']);case['goals']=[];case['projectNotes']='';case['decisions']=[]
        child={k:'' for k in ['address','phone','school','education','father','mother']};child.update(row['child']);child['familyId']='';child['preferences']=[]
        for p in rows(c,'SELECT payload FROM case_profiles WHERE case_id=:id',id=row['id']):child.update(p['payload'])
        child.update(asdict(ChildSummaryDTO(row['child_id'],row['child_code'])))
        child.update(name=bi(row['child_code'],row['child_code']),birthDate='',birthplace='',gender='',address='',phone='',father='',mother='',school='')
        for goal in rows(c,'SELECT payload FROM roadmap_objectives WHERE case_id=:id ORDER BY id',id=row['id']):case['goals'].append(goal['payload'])
        roadmap=one(c,'SELECT payload,version FROM roadmaps WHERE case_id=:id',id=row['id'])
        if roadmap:case['projectNotes']=roadmap['payload'].get('notes','');case['roadmapVersion']=roadmap['version']
        cases.append(case)
        if case['status']=='active' or row['child_id'] not in child_projections:child_projections[row['child_id']]=child
        cats=['general','social','psychological','educational','assessment','roadmap','administrative']
        access[row['id']]={'categories':{cat:{act:policy.can_access_case(row['id'],cat,act) for act in ['read','write']} for cat in cats}}
        access[row['id']]['forms']={f['id']:bool(one(c,"SELECT authz.record_allowed(:case,:category,:sensitivity,:id,'read') AS ok",case=row['id'],category=f['category'],sensitivity=3 if f['category']=='psychological' else 1,id=row['id']+'-'+f['id'])['ok']) for f in rows(c,'SELECT id,category FROM form_definitions')}
        access[row['id']]['identity']={op:policy.capability('child.identity.'+op) and bool(one(c,'SELECT authz.has_scope(:case,:scope) AS ok',case=row['id'],scope='child.identity.'+op)['ok']) for op in ('read','write')}
        templates[row['id']]=[t['payload'] for t in rows(c,'SELECT * FROM recommendation_templates ORDER BY id') if policy.can_use_recommendation_template(row['id'],t)]
    children=list(child_projections.values())
    case_ids=[x['id'] for x in cases]
    events=[]
    for table in ['observations','initial_assessments','professional_notes','intervention_events','case_status_history']:
        for row in rows(c,f'SELECT id,case_id,author_id,created_at,payload FROM {table} ORDER BY created_at'):
            if not one(c,'SELECT authz.journey_source_allowed(:case,:kind,:id) AS ok',case=row['case_id'],kind=table,id=row['id'])['ok']:continue
            p=row['payload']
            events.append(p if 'type' in p and 'title' in p else {'id':row['id'],'caseId':row['case_id'],'professionalId':row['author_id'],'date':row['created_at'].isoformat(),'type':'observation','title':bi('مساهمة مهنية','Contribution professionnelle'),'note':p.get('note',''),'stage':next(x['stage'] for x in cases if x['id']==row['case_id'])})
    sessions=[]
    for s in rows(c,'SELECT id,payload FROM activity_sessions ORDER BY id'):
        sessions.append({**s['payload'],'participants':[p['payload'] for p in rows(c,'SELECT payload FROM session_participants WHERE session_id=:id ORDER BY case_id',id=s['id'])]})
    catalogue=rows(c,'SELECT id,kind,payload FROM interventions ORDER BY id')
    submissions=[r['payload'] for r in rows(c,'SELECT payload FROM document_versions WHERE form_id IS NOT NULL ORDER BY id')]
    # Access fingerprint derives from live authoritative scope, not search indexes.
    group_state=[dict(r) for r in rows(c,'SELECT id,group_id,case_id,membership_status,valid_to FROM child_group_memberships ORDER BY id')]
    fingerprint=hashlib.sha256(json.dumps([e.employee_id,case_ids,access,templates,[s['id'] for s in submissions],group_state],sort_keys=True,default=str).encode()).hexdigest()
    recommendations=[]
    for r in rows(c,'SELECT rc.id,rc.payload FROM recommendation_candidates rc ORDER BY id'):
        feedback=one(c,'SELECT status,reason FROM recommendation_feedback WHERE candidate_id=:id ORDER BY created_at DESC LIMIT 1',id=r['id'])
        if feedback:recommendations.append({**r['payload'],'status':{'ACCEPTED':'accepted','MODIFIED':'accepted','REJECTED':'rejected','DEFERRED':'deferred'}[feedback['status']],'feedback':feedback['reason']})
    roadmap_history=[{'id':r['id'],'caseId':r['case_id'],'version':r['version'],'date':r['created_at'].isoformat(),'authorId':r['author_id']} for r in rows(c,'SELECT id,case_id,version,created_at,author_id FROM roadmap_versions ORDER BY created_at DESC')]
    planned=[{'id':r['id'],'caseId':r['case_id'],**r['payload']} for r in rows(c,'SELECT id,case_id,payload FROM planned_interventions ORDER BY created_at DESC')]
    result=dict(schemaVersion=1,demoDate='2026-11-16',children=children,families=payloads(c,'families'),centers=payloads(c,'centres'),professionals=payloads(c,'employees'),assignments=[{'caseId':i,'professionalId':e.employee_id} for i in case_ids],cases=cases,events=events,submissions=submissions,activities=[r['payload'] for r in catalogue if r['kind']=='activity'],resources=[r['payload'] for r in catalogue if r['kind']=='resource'],partners=payloads(c,'partner_structures'),sessions=sessions,recommendations=recommendations,appointments=payloads(c,'appointments'),tasks=payloads(c,'tasks'),integrations=[],transfers=[],posts=[],conversations=[],searchHistory=[],searchHistories={},backend={'access':access,'templates':templates,'fingerprint':fingerprint,'authority':'server','roadmapHistory':roadmap_history,'plannedInterventions':planned,'documentMetadata':[dict(r) for r in rows(c,'SELECT * FROM authz.document_metadata()')]})
    return ChildPrivacyService(c).project(result)

def event(c,e,case_id,kind,title,note='',source=None,category='educational'):
    case=one(c,'SELECT payload FROM cases WHERE id=:id',id=case_id)
    item={'id':uid('event'),'caseId':case_id,'date':now(),'type':kind,'title':title,'note':note,'professionalId':e.employee_id,'stage':case['payload']['stage'],'sourceId':source}
    record(c,'intervention_events',item['id'],case_id,item,category,e.employee_id,source=source)

def create_case(c,e,body):
    policy=AuthorizationService(c,e)
    if not policy.capability('cases.create'):policy.deny('case')
    today=date.today();existing=body.get('existingCaseId')
    if existing:
        policy.require_case(existing)
        if not policy.capability('child.identity.write') or not one(c,"SELECT authz.has_scope(:id,'child.identity.write') AS ok",id=existing)['ok']:policy.deny('child_identity')
        previous=one(c,'SELECT child_id,centre_id,payload FROM cases WHERE id=:id FOR UPDATE',id=existing)
        if previous['payload']['status']=='active':error('SUCCESSIVE_CASE_REQUIRES_CLOSED_CASE',409)
        if one(c,"SELECT id FROM cases WHERE child_id=:id AND payload->>'status'='active'",id=previous['child_id']):error('ACTIVE_CASE_EXISTS',409)
        link=one(c,'SELECT family_id FROM case_family_links WHERE case_id=:id',id=existing)
        if link:body={**body,'familyId':link['family_id']}
    else:
        born=date.fromisoformat(body['birthDate'])
        age=today.year-born.year-((today.month,today.day)<(born.month,born.day))
        if age<0 or age>=18 or not body['name']['ar'].strip():error('INVALID_CHILD')
    centre=one(c,'SELECT centre_id FROM employee_centres WHERE employee_id=:id AND active ORDER BY centre_id LIMIT 1',id=e.employee_id)['centre_id']
    if existing:centre=previous['centre_id']
    number=one(c,"SELECT nextval('case_number') AS n")['n'];case_id=f'CDIS-{number:03}';child_id=previous['child_id'] if existing else uid('child')
    family_id=body.get('familyId') or uid('family')
    if body.get('familyId') and not one(c,'SELECT id FROM families WHERE id=:id',id=family_id):policy.deny('family')
    if not existing:
        child={'id':child_id,'name':body['name'],'birthDate':body['birthDate'],'birthplace':'','gender':body['gender'],'familyId':family_id,**{k:body.get(k,'') for k in ('address','father','mother')}}
        insert(c,'children',{'id':child_id,'payload':child})
    case={'id':case_id,'childId':child_id,'centerId':centre,'referentId':e.employee_id,'openedAt':today.isoformat(),'stage':1,'status':'active','nextDue':(today+timedelta(days=30)).isoformat(),'source':body.get('source',''),'cycle':1,'subStages':{},'supervised':False}
    insert(c,'cases',{'id':case_id,'child_id':child_id,'centre_id':centre,'payload':case})
    aid=uid('assignment');insert(c,'case_assignments',{'id':aid,'case_id':case_id,'employee_id':e.employee_id,'role_id':'social','assignment_status':'ACTIVE','assigned_by':e.employee_id})
    for scope in ['general.read','general.write','social.read','social.write','educational.read','assessment.read','assessment.write','roadmap.read','roadmap.write','administrative.read','child.identity.read','child.identity.write','journey.summary.generate','journey.summary.review']:
        insert(c,'assignment_scopes',{'case_assignment_id':aid,'scope_code':scope,'granted_by':e.employee_id})
    if not body.get('familyId'):insert(c,'families',{'id':family_id,'centre_id':centre,'author_id':e.employee_id,'payload':{'id':family_id,'label':bi('أسرة اصطناعية — '+case_id,'Famille synthétique — '+case_id),'members':[],'notes':''}})
    insert(c,'case_family_links',{'case_id':case_id,'family_id':family_id,'confirmed_by':e.employee_id})
    record(c,'case_profiles','social-'+case_id,case_id,{**{k:body.get(k,'') for k in ['address','father','mother']},'familyId':family_id},'social',e.employee_id)
    record(c,'roadmaps','roadmap-'+case_id,case_id,{'notes':''},'roadmap',e.employee_id)
    event(c,e,case_id,'registration',bi('إنشاء الملف المركزي','Création du dossier central'),category='general')
    publish(c,e.employee_id,'CASE_CREATED',case_id);audit(c,e.employee_id,'case.create','case',case_id)
    return {'id':case_id,'child_code':one(c,'SELECT child_code FROM children WHERE id=:id',id=child_id)['child_code']}

def save_form(c,e,body):
    case_id=body['caseId'];form_id=body['formId'];policy=AuthorizationService(c,e)
    form=one(c,'SELECT payload,category FROM form_definitions WHERE id=:id',id=form_id)
    if not form:policy.deny('form')
    category=form['category'];did=case_id+'-'+form_id
    if not one(c,"SELECT authz.record_allowed(:case,:cat,:s,:id,'write') AS ok",case=case_id,cat=category,s=3 if category=='psychological' else 1,id=did)['ok']:policy.deny('form')
    case=one(c,'SELECT payload,centre_id FROM cases WHERE id=:id',id=case_id)
    if case['payload']['status']!='active':error('INACTIVE_CASE',409)
    fields=[f for section in form['payload']['sections'] for f in section['fields']];values=dict(body['values'])
    protected={'name','birthDate','birthplace','gender','address','phone','father','mother','school'}
    code=one(c,'SELECT ch.child_code FROM children ch JOIN cases ca ON ca.child_id=ch.id WHERE ca.id=:id',id=case_id)['child_code']
    for f in fields:
        if f.get('shared') in protected:values[f['key']]=code if f['shared']=='name' else ''
    allowed={f['key'] for f in fields}
    if set(values)-allowed:error('UNKNOWN_FORM_FIELD')
    for field in fields:
        if field['key'] not in values:continue
        value=values[field['key']];kind=field['type']
        if kind in ('text','textarea','date','time','select','radio') and not isinstance(value,str):error('INVALID_FORM_VALUE')
        if kind=='number' and not isinstance(value,(int,float,str)):error('INVALID_FORM_VALUE')
        if kind in ('multi','table') and not isinstance(value,list):error('INVALID_FORM_VALUE')
        if isinstance(value,str) and len(value)>16000:error('FORM_FIELD_TOO_LONG')
        if field.get('options') and kind in ('select','radio') and value and value not in [o['value'] for o in field['options']]:error('INVALID_FORM_OPTION')
    if body['status']!='draft':
        for f in fields:
            if f.get('condition') and values.get(f['condition']['field'])!=f['condition']['value']:continue
            if f.get('required') and f.get('shared') not in protected and values.get(f['key']) in (None,'',[],{}):error('REQUIRED_FORM_FIELD')
    doc=one(c,'SELECT id FROM documents WHERE id=:id',id=did)
    if not doc:insert(c,'documents',{'id':did,'case_id':case_id,'centre_id':case['centre_id'],'category':category,'sensitivity':3 if category=='psychological' else 1,'title':form['payload']['title'],'approval_status':'DRAFT','created_by':e.employee_id})
    # Serialize version allocation across collaborators; never overwrite another professional's draft.
    c.execute(text('SELECT pg_advisory_xact_lock(hashtextextended(:id,0))'),{'id':did})
    prior=one(c,"SELECT id,version,status,author_id FROM document_versions WHERE document_id=:id ORDER BY version DESC LIMIT 1",id=did)
    updating=prior and prior['status']=='draft' and prior['author_id']==e.employee_id
    version=prior['version'] if updating else (prior['version']+1 if prior else 1)
    vid=prior['id'] if updating else body.get('id',uid('document'))
    item={'id':vid,'caseId':case_id,'formId':form_id,'values':values,'status':body['status'],'date':now(),'authorId':e.employee_id,'version':version,'definitionVersion':form['payload']['version'],'stage':case['payload']['stage'] if case['payload']['stage'] in form['payload']['stages'] else form['payload']['stages'][0],'cycle':case['payload'].get('cycle',1)}
    raw=json.dumps(item,ensure_ascii=False,sort_keys=True).encode();sha=hashlib.sha256(raw).hexdigest();relative=f'{uuid.uuid4().hex}.json'
    settings.private_path.mkdir(parents=True,exist_ok=True);(settings.private_path/relative).write_bytes(raw)
    if updating:c.execute(text('UPDATE document_versions SET payload=CAST(:p AS jsonb),status=:status,storage_reference=:ref,sha256=:sha WHERE id=:id'),{'p':json.dumps(item),'status':body['status'],'ref':relative,'sha':sha,'id':vid})
    else:insert(c,'document_versions',{'id':vid,'document_id':did,'case_id':case_id,'form_id':form_id,'version':version,'language':body['language'],'status':body['status'],'author_id':e.employee_id,'payload':item,'storage_reference':relative,'sha256':sha},ignore_conflicts=False)
    publish(c,e.employee_id,'DOCUMENT_VERSION_CREATED',vid,version)
    if body['status']=='validated':c.execute(text('SELECT authz.mark_document_approved(:id)'),{'id':did})
    audit(c,e.employee_id,'form.save','document_version',vid,status=body['status'],version=version)
    return {'id':vid,'version':version}

def update_roadmap(c,e,case_id,goals,notes,expected_version):
    policy=AuthorizationService(c,e);policy.require_case(case_id,'roadmap','write')
    row=one(c,'SELECT id,payload,version FROM roadmaps WHERE case_id=:id FOR UPDATE',id=case_id)
    if not row or row['version']!=expected_version:error('VERSION_CONFLICT',409)
    existing={r['id']:r for r in rows(c,'SELECT id,payload FROM roadmap_objectives WHERE case_id=:id',id=case_id)}
    if set(existing)-{g['id'] for g in goals}:error('OBJECTIVES_MUST_BE_HISTORIZED')
    for goal in goals:
        previous=existing.get(goal['id']);g=dict(goal)
        if g.get('confirmed') and (not previous or not previous['payload'].get('confirmed')):g.update(confirmedBy=e.employee_id,confirmedAt=now())
        elif previous:
            for key in ['confirmedBy','confirmedAt']:
                if key in previous['payload']:g[key]=previous['payload'][key]
        if previous:c.execute(text('UPDATE roadmap_objectives SET payload=CAST(:p AS jsonb),author_id=:e,version=version+1,updated_at=now() WHERE id=:id'),{'p':json.dumps(g),'e':e.employee_id,'id':g['id']})
        else:record(c,'roadmap_objectives',g['id'],case_id,g,'roadmap',e.employee_id,roadmap_id=row['id'])
    version=row['version']+1
    c.execute(text("UPDATE roadmaps SET payload=CAST(:p AS jsonb),version=:v,author_id=:e,updated_at=now() WHERE id=:id"),{'p':json.dumps({'notes':notes}),'v':version,'e':e.employee_id,'id':row['id']})
    record(c,'roadmap_versions',uid('roadmap-version'),case_id,{'notes':notes,'goals':goals},'roadmap',e.employee_id,status='APPROVED',version=version,roadmap_id=row['id'])
    event(c,e,case_id,'goal',bi('مراجعة مهنية للخطة','Révision professionnelle du plan'),source=row['id'],category='roadmap')
    publish(c,e.employee_id,'ROADMAP_UPDATED',row['id'],version);audit(c,e.employee_id,'roadmap.update','roadmap',row['id'],version=version)
    return {'version':version}

def add_observation(c,e,case_id,note,category):
    policy=AuthorizationService(c,e);policy.require_case(case_id,category,'write')
    case=one(c,'SELECT payload FROM cases WHERE id=:id',id=case_id)['payload']
    key=uid('observation');record(c,'observations',key,case_id,{'note':note,'stage':case['stage'],'cycle':case.get('cycle',1)},category,e.employee_id,sensitivity=3 if category=='psychological' else 1)
    publish(c,e.employee_id,'OBSERVATION_CREATED',key);audit(c,e.employee_id,'observation.create','observation',key)
    return {'id':key}

def update_identity(c,e,case_id,changes):
    return ChildIdentityService(c,e).update(case_id,changes)
