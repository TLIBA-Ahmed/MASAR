from collections import defaultdict,deque
from contextlib import contextmanager
import hashlib,hmac,secrets,time,json,re
from fastapi import FastAPI,Request,Response,HTTPException,Query,Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel,ConfigDict,Field,model_validator
from sqlalchemy.exc import DBAPIError
from ..config import settings
from ..db import transaction,rows,one
from ..identity import DemoIdentityProvider,resolve_employee,token_hash
from ..identity.entry import governorates,public_centres,demo_profiles,authorized_centres,select_centre,preserve_governorate_labels
from ..authorization import AuthorizationService,Purpose
from ..events import audit
from ..privacy import ChildPrivacyService,ChildIdentityService
from ..forum import snapshot as forum_snapshot,create_post,change_post,send_message
from ..forum.attachments import IncomingAttachment,publish as publish_forum_attachment,download as download_forum_attachment,MAX_BYTES as FORUM_MAX_BYTES,MAX_FILES as FORUM_MAX_FILES
from ..journey import overview as journey_overview,read_journey,open_document as open_journey_document
from ..journey.summary_service import journey_summary_service
from ..group_management import assigned_groups,roster,revoke_assignment,end_membership,enroll
from ..case_management import workspace,create_case,save_form,update_roadmap,add_observation,update_identity
from typing import Literal,Any
from ..retrieval import AuthorizedRetrievalService
from ..browser import IntelligentBrowserService
from ..recommendations import central_recommendation_engine,available_templates,plan_intervention
from ..documents import register_upload,approve,private_file
from ..ai_client import gateway,LocalModelError
from fastapi import UploadFile,File,Form
from fastapi.responses import FileResponse

app=FastAPI(title='MASAR authorized modular API',version='1.0.0')
app.add_middleware(CORSMiddleware,allow_origins=list(settings.origins),allow_credentials=True,allow_methods=['GET','POST','PUT','PATCH'],allow_headers=['Content-Type','X-Masar-CSRF'])
rate=defaultdict(deque)


class Payload(BaseModel):
    model_config=ConfigDict(extra='forbid')


class Workplace(Payload):
    governorate_id:str=Field(pattern=r'^TN-\d{2}$')
    centre_id:str=Field(min_length=1,max_length=64)
class DemoLogin(Payload):
    employee_id:str=Field(min_length=1,max_length=64)
    governorate_id:str|None=Field(default=None,pattern=r'^TN-\d{2}$')
    centre_id:str|None=Field(default=None,min_length=1,max_length=64)
    @model_validator(mode='after')
    def workplace_pair(self):
        if (self.governorate_id is None)!=(self.centre_id is None):raise ValueError('Both workplace fields are required together')
        return self
class Reason(Payload): reason: str=Field(min_length=3,max_length=1000)
class ForumContent(Payload): body: str=Field(min_length=1,max_length=10000)
class ForumPreference(Payload): active: bool
class Enrollment(Reason):case_id:str=Field(pattern=r'^CDIS-\d{3,8}$')
class CaseExport(Payload):case_ids:list[str]=Field(max_length=500)
class SearchInput(Payload):
    q:str=Field(max_length=300)
    category:str=Field(default='all',max_length=40)
class ChildIdentity(Payload):
    ar:str=Field(min_length=1,max_length=150)
    fr:str=Field(min_length=1,max_length=150)
class NewCase(Payload):
    familyId:str|None=Field(default=None,max_length=100)
    name:ChildIdentity
    birthDate:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    gender:Literal['male','female']
    address:str=Field(default='',max_length=500)
    father:str=Field(default='',max_length=150)
    mother:str=Field(default='',max_length=150)
    source:str=Field(default='',max_length=500)
class FormSave(Payload):
    id:str|None=Field(default=None,max_length=100)
    caseId:str=Field(max_length=64)
    formId:str=Field(pattern=r'^F(0[1-9]|1[0-9]|2[0-2])
    values:dict[str,Any]
    status:Literal['draft','completed','validated']
    language:Literal['ar','fr']
class Goal(Payload):
    id:str=Field(max_length=100)
    skill:str=Field(max_length=100)
    description:ChildIdentity
    confirmed:bool
    dueDate:str=Field(max_length=10)
    confirmedBy:str|None=None
    confirmedAt:str|None=None
class RoadmapUpdate(Payload):
    goals:list[Goal]=Field(max_length=50)
    notes:str=Field(max_length=10000)
    expected_version:int=Field(ge=1)
class ObservationInput(Payload):
    note:str=Field(min_length=1,max_length=10000)
    category:Literal['social','educational','psychological','assessment']
class IdentityChanges(Payload):
    first_name:ChildIdentity|None=None
    last_name:ChildIdentity|None=None
    name:ChildIdentity|None=None
    birthDate:str|None=Field(default=None,pattern=r'^\d{4}-\d{2}-\d{2}$')
    birthplace:str|None=Field(default=None,max_length=300)
    gender:Literal['male','female']|None=None
    address:str|None=Field(default=None,max_length=1000)
    phone:str|None=Field(default=None,max_length=50)
    father:str|None=Field(default=None,max_length=150)
    mother:str|None=Field(default=None,max_length=150)
    school:str|None=Field(default=None,max_length=300)
    education:str|None=Field(default=None,max_length=300)
    preferences:list[str]|None=Field(default=None,max_length=30)
class IdentityUpdate(Payload):changes:IdentityChanges
class SummaryGeneration(Payload):
    cycle_id:int|None=Field(default=None,ge=1,le=1000)
    manual:dict[Literal['ar','fr'],str]|None=None
class SummaryReview(Reason):
    status:Literal['approved','rejected']
class BrowserQuestion(Payload):
    question:str=Field(min_length=2,max_length=1000)
    language:Literal['ar','fr']
    case_id:str|None=Field(default=None,max_length=64)
    group_id:str|None=Field(default=None,max_length=64)
    operation:Literal['group_count','pending_objectives','assessment_count','intervention_count']|None=None
class Constraints(Payload):
    maxDuration:int=Field(default=90,ge=5,le=240)
    format:Literal['any','individual','group']='any'
    participants:int=Field(default=1,ge=1,le=30)
    materials:list[str]=Field(default_factory=list,max_length=40)
class RecommendationInput(Payload):
    activityId:str|None=Field(default=None,max_length=80)
    contextId:str=Field(max_length=80)
    caseId:str=Field(max_length=64)
    language:Literal['ar','fr']
    goalIds:list[str]=Field(default_factory=list,max_length=50)
    groupId:str|None=None
    projectId:str|None=None
    workshopId:str|None=None
    constraints:Constraints=Field(default_factory=Constraints)
    request:str=Field(default='',max_length=500)
    additionalConstraints:str=Field(default='',max_length=500)
class Feedback(Reason):status:Literal['ACCEPTED','MODIFIED','REJECTED','DEFERRED']
class Plan(Reason):
    prerequisites_confirmed:Literal[True]
    intervention_id:str=Field(max_length=80)
    goal_ids:list[str]=Field(min_length=1,max_length=30)
    date:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    idempotency_key:str=Field(pattern=r'^[a-zA-Z0-9-]{12,64}$')
class RecordInput(Payload):
    id:str=Field(max_length=100)
    caseId:str
    title:ChildIdentity
    professionalId:str
    completed:bool=False
    dueDate:str|None=None
    type:Literal['interview','evaluation','meeting','followUp']|None=None
    date:str|None=None
    time:str|None=None
    notes:str=Field(default='',max_length=5000)
class Participation(Payload):
    caseId:str
    attendance:Literal['present','absent','excused']
    engagement:Literal['active','partial','observing']
    observations:str=Field(max_length=5000)
    progress:str=Field(max_length=5000)
class SessionUpdate(Payload):
    id:str
    activityId:str
    date:str
    time:str
    educatorId:str
    group:str
    participants:list[Participation]=Field(min_length=1,max_length=30)
    status:Literal['planned','inProgress','completed','postponed','cancelled']
    adaptations:str=Field(max_length=5000)
    goalIds:list[str]
    recommendationId:str|None=None


def new_csrf(response):
    nonce=secrets.token_urlsafe(24)
    value=nonce+'.'+hmac.new(settings.secret.encode(),nonce.encode(),'sha256').hexdigest()
    response.set_cookie('masar_csrf',value,httponly=True,secure=settings.cookie_secure,samesite='strict',max_age=28800)
    return value


@app.middleware('http')
async def security(request,call_next):
    key=hashlib.sha256((request.cookies.get('masar_session') or (request.client.host if request.client else 'local')).encode()).hexdigest()
    now=time.monotonic(); queue=rate[key]
    while queue and queue[0]<now-60: queue.popleft()
    if len(queue)>=240: return JSONResponse({'detail':{'code':'RATE_LIMIT'}},429)
    queue.append(now)
    if len(rate)>4096:
        for k in list(rate)[:2048]:
            if not rate[k] or rate[k][-1]<now-60: del rate[k]
    try:length=int(request.headers.get('content-length','0'))
    except ValueError:return JSONResponse({'detail':{'code':'INVALID_CONTENT_LENGTH'}},400)
    if length>9*1024*1024: return JSONResponse({'detail':{'code':'PAYLOAD_TOO_LARGE'}},413)
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if origin and origin not in settings.origins: return JSONResponse({'detail':{'code':'ORIGIN_DENIED'}},403)
        cookie=request.cookies.get('masar_csrf',''); header=request.headers.get('x-masar-csrf','')
        parts=cookie.rsplit('.',1)
        valid=len(parts)==2 and hmac.compare_digest(parts[1],hmac.new(settings.secret.encode(),parts[0].encode(),'sha256').hexdigest())
        if not valid or not hmac.compare_digest(cookie,header): return JSONResponse({'detail':{'code':'CSRF_REQUIRED'}},403)
    response=await call_next(request)
    # Final defence for every JSON API, including notifications, Forum and errors.
    # Identity is returned exclusively by the explicit, separately authorized GET.
    identity_read=request.method=='GET' and re.fullmatch(r'/api/v1/cases/[^/]+/identity',request.url.path)
    if 'application/json' in response.headers.get('content-type','') and not identity_read:
        raw=b''.join([chunk async for chunk in response.body_iterator])
        value=json.loads(raw)
        try:
            def protect():
                try:actor=resolve_employee(request).employee_id
                except HTTPException:actor=None
                with transaction(actor,Purpose.CASE_READ) as privacy_db:
                    projected=ChildPrivacyService(privacy_db).project(value)
                    if request.method=='GET' and request.url.path=='/api/v1/entry/governorates' and response.status_code==200:
                        projected=preserve_governorate_labels(value,projected)
                    return projected
            value=await run_in_threadpool(protect)
        except DBAPIError:
            return JSONResponse({'detail':{'code':'PRIVACY_PROJECTION_UNAVAILABLE'}},503,headers={'Cache-Control':'no-store'})
        cookies=[(k,v) for k,v in response.raw_headers if k.lower()==b'set-cookie']
        response=JSONResponse(value,status_code=response.status_code,headers={k:v for k,v in response.headers.items() if k.lower() not in ('content-length','content-type','set-cookie')})
        response.raw_headers.extend(cookies)
    if response.status_code in (401,403,404,409,422):
        try:
            try:employee=resolve_employee(request).employee_id
            except HTTPException:employee=None
            with transaction(employee,'audit.read') as c:audit(c,employee,'request.denied','api',getattr(request.scope.get('route'),'path','unmatched'),success=False,status_code=response.status_code)
        except DBAPIError:pass
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='same-origin'
    return response


@app.exception_handler(DBAPIError)
async def database_error(request,error):
    return JSONResponse({'detail':{'code':'DATABASE_OPERATION_REFUSED'}},409)

@app.exception_handler(ValueError)
async def invalid_business_value(request,error):
    return JSONResponse({'detail':{'code':'INVALID_BUSINESS_VALUE'}},422)


@contextmanager
def authorized(request,purpose):
    employee=resolve_employee(request)
    with transaction(employee.employee_id,purpose) as c:
        yield c,employee


@app.get('/api/v1/health')
def health():
    with transaction() as c: one(c,'SELECT 1 AS ok')
    return {'status':'ok','identity_mode':settings.identity_mode,'ai_mode':settings.ai_mode,'synthetic_only':True}


@app.get('/api/v1/bootstrap')
def bootstrap(response: Response):
    with transaction() as c:
        centres=[centre for g in governorates(c) for centre in public_centres(c,g['id'])]
    return {'professionals':[],'centers':centres,'csrf_token':new_csrf(response),'identity_mode':settings.identity_mode,'features':{'professionalNetwork':settings.professional_network,'laterLifecycle':False}}


@app.get('/api/v1/entry/governorates')
def entry_governorates():
    with transaction() as c:return governorates(c)


@app.get('/api/v1/entry/governorates/{governorate_id}/centres')
def entry_centres(governorate_id:str=Path(pattern=r'^TN-\d{2}$')):
    with transaction() as c:return public_centres(c,governorate_id)


@app.get('/api/v1/auth/demo/professionals')
def entry_profiles(governorate_id:str=Query(pattern=r'^TN-\d{2}$'),centre_id:str=Query(min_length=1,max_length=64)):
    with transaction() as c:return demo_profiles(c,governorate_id,centre_id)


@app.post('/api/v1/auth/demo/login')
def login(body: DemoLogin,response:Response):
    token=DemoIdentityProvider().establish_session(body.employee_id,body.governorate_id,body.centre_id)
    response.set_cookie('masar_session',token,httponly=True,secure=settings.cookie_secure,samesite='strict',max_age=28800)
    with transaction(body.employee_id,'identity') as c: audit(c,body.employee_id,'session.start','session')
    return {'csrf_token':new_csrf(response),'mode':'demo'}


@app.post('/api/v1/auth/logout')
def logout(request:Request,response:Response):
    with transaction() as c: one(c,'SELECT authz.revoke_session(:hash)',hash=token_hash(request.cookies.get('masar_session','')))
    response.delete_cookie('masar_session')
    return {'csrf_token':new_csrf(response)}


def employee_view(c,e):
    professional=one(c,'SELECT payload FROM employees WHERE id=:id',id=e.employee_id)['payload']
    choices=authorized_centres(c,e.employee_id)
    centres=[r['id'] for r in choices]
    current=one(c,'SELECT authz.session_entry_centre(CAST(:session AS uuid)) AS id',session=e.session_id)['id']
    selected=current if current in centres else next(iter(centres),None)
    professional={**professional,'centerId':selected or professional['centerId']}
    roles=[r['role_id'] for r in rows(c,'SELECT role_id FROM employee_roles WHERE employee_id=:id',id=e.employee_id)]
    return {'employeeId':e.employee_id,'centreIds':centres,'centres':choices,'selectedCentreId':selected,'roles':roles,'active':True,'sessionId':e.session_id,'professional':professional,'capabilities':[r['permission'] for r in rows(c,'SELECT DISTINCT permission FROM role_permissions WHERE authz.capability(permission)')]}


@app.post('/api/v1/auth/centre')
def change_session_centre(body:Workplace,request:Request):
    with authorized(request,'identity') as (c,e):return select_centre(c,e,body.governorate_id,body.centre_id)


@app.get('/api/v1/me')
def me(request:Request):
    with authorized(request,'identity') as (c,e): return employee_view(c,e)


@app.get('/api/v1/me/assigned-groups')
def my_groups(request:Request):
    with authorized(request,Purpose.GROUP_READ) as (c,e): return {'groups':assigned_groups(c,e)}


@app.get('/api/v1/groups/{group_id}/children')
def group_children(group_id:str,request:Request):
    with authorized(request,Purpose.GROUP_READ) as (c,e): return roster(c,e,group_id)


@app.get('/api/v1/cases/{case_id}')
def child_folder(case_id:str,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        AuthorizationService(c,e).require_case(case_id)
        audit(c,e.employee_id,'case.read','case',case_id)
        data=workspace(c,e)
        return {'case':next(x for x in data['cases'] if x['id']==case_id),'child':next(x for x in data['children'] if x['id']==next(x['childId'] for x in data['cases'] if x['id']==case_id)),'observations':[x for x in data['events'] if x['caseId']==case_id],'documents':[x for x in data['submissions'] if x['caseId']==case_id]}

@app.get('/api/v1/cases/{case_id}/access')
def child_folder_access(case_id:str,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        AuthorizationService(c,e).require_active_session();AuthorizationService(c,e).require_case(case_id)
        audit(c,e.employee_id,'case.open','case',case_id)
        return {'case_id':case_id,'allowed':True}

@app.get('/api/v1/workspace')
def read_workspace(request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):data=workspace(c,e)
    if settings.professional_network:
        with transaction(e.employee_id,Purpose.FORUM_READ) as c:data.update(forum_snapshot(c,e))
    return data

@app.get('/api/v1/exports/workspace')
def export_workspace(request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        AuthorizationService(c,e).require_active_session()
        data=workspace(c,e)
        audit(c,e.employee_id,'export.workspace','authorized_scope',case_count=len(data['cases']))
        return data

@app.post('/api/v1/exports/cases')
def export_case_codes(body:CaseExport,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        policy=AuthorizationService(c,e);policy.require_active_session()
        for key in set(body.case_ids):policy.require_case(key)
        result=[dict(r) for r in rows(c,"SELECT ca.id,ch.child_code,(ca.payload->>'stage')::integer AS stage,ca.payload->>'status' AS status FROM cases ca JOIN children ch ON ch.id=ca.child_id WHERE ca.id=ANY(:ids) ORDER BY ca.id",ids=body.case_ids)]
        audit(c,e.employee_id,'export.cases','authorized_scope',case_count=len(result))
        return {'cases':result}

@app.get('/api/v1/cases/{case_id}/forms/{form_id}/access')
def form_export_access(case_id:str,form_id:str,request:Request,version_id:str|None=Query(default=None,max_length=100)):
    with authorized(request,Purpose.FORM_READ) as (c,e):
        policy=AuthorizationService(c,e);policy.require_active_session();policy.require_case(case_id)
        form=one(c,'SELECT category FROM form_definitions WHERE id=:id',id=form_id)
        if not form or not one(c,"SELECT authz.record_allowed(:case,:cat,:s,:id,'read') AS ok",case=case_id,cat=form['category'],s=3 if form['category']=='psychological' else 1,id=case_id+'-'+form_id)['ok']:policy.deny('form')
        if version_id and not one(c,'SELECT id FROM document_versions WHERE id=:id AND case_id=:case AND form_id=:form',id=version_id,case=case_id,form=form_id):policy.deny('document')
        audit(c,e.employee_id,'export.form','case',case_id,form_id=form_id)
        return {'allowed':True}


@app.get('/api/v1/journeys/assigned')
def assigned_journeys(request:Request,q:str=Query(default='',max_length=200),group_id:str|None=Query(default=None,max_length=64)):
    with authorized(request,Purpose.CASE_READ) as (c,e):return journey_overview(c,e,q,group_id)


@app.get('/api/v1/cases/{case_id}/journey')
def case_journey(case_id:str,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):return read_journey(c,e,case_id)


@app.get('/api/v1/cases/{case_id}/journey/stages/{stage_id}')
def case_journey_stage(case_id:str,request:Request,stage_id:int=Path(ge=1,le=5)):
    with authorized(request,Purpose.CASE_READ) as (c,e):return read_journey(c,e,case_id,stage_id)


@app.get('/api/v1/cases/{case_id}/journey/documents/{version_id}/open')
def journey_document_open(case_id:str,version_id:str,request:Request):
    with authorized(request,Purpose.FORM_READ) as (c,e):return open_journey_document(c,e,case_id,version_id)

@app.get('/api/v1/cases/{case_id}/journey/summaries')
def journey_summary_cards(case_id:str,request:Request):
    with authorized(request,'journey.summary.read') as (c,e):return journey_summary_service.cards(c,e,case_id)

@app.post('/api/v1/cases/{case_id}/journey/summaries/stages/{stage_id}')
def generate_journey_summary(case_id:str,body:SummaryGeneration,request:Request,stage_id:int=Path(ge=1,le=5)):
    if body.manual and (set(body.manual)!={'ar','fr'} or any(not v.strip() or len(v)>2000 for v in body.manual.values())):raise HTTPException(422,detail={'code':'INVALID_MANUAL_SUMMARY'})
    return journey_summary_service.generate(resolve_employee(request),case_id,stage_id,body.cycle_id,body.manual)

@app.get('/api/v1/cases/{case_id}/journey/summaries/stages/{stage_id}/history')
def journey_summary_history(case_id:str,request:Request,stage_id:int=Path(ge=1,le=5),cycle_id:int|None=Query(default=None,ge=1,le=1000)):
    with authorized(request,'journey.summary.read') as (c,e):return journey_summary_service.history(c,e,case_id,stage_id,cycle_id)

@app.get('/api/v1/cases/{case_id}/journey/summaries/stages/{stage_id}/sources')
def journey_summary_sources(case_id:str,request:Request,stage_id:int=Path(ge=1,le=5),summary_id:str|None=Query(default=None,max_length=80),source_kind:str|None=Query(default=None,max_length=40),source_id:str|None=Query(default=None,max_length=100)):
    with authorized(request,'journey.summary.read') as (c,e):
        result=journey_summary_service.evidence(c,e,case_id,summary_id,stage_id)
        if source_id or source_kind:
            if not any(s['kind']==source_kind and s['id']==source_id for s in result['sources']):AuthorizationService(c,e).deny('journey_evidence')
            if source_kind=='document_versions':return open_journey_document(c,e,case_id,source_id)
            return {'path':'/cases/'+case_id+'?tab='+('project' if source_kind in ('roadmap_objectives','roadmap_versions') else 'activities' if source_kind=='activity_sessions' else 'history')}
        return result

@app.post('/api/v1/cases/{case_id}/journey/summaries/{summary_id}/review')
def review_journey_summary(case_id:str,summary_id:str,body:SummaryReview,request:Request):
    with authorized(request,'journey.summary.review') as (c,e):return journey_summary_service.review(c,e,case_id,summary_id,body.status,body.reason)


@app.get('/api/v1/forum')
def read_forum(request:Request):
    with authorized(request,Purpose.FORUM_READ) as (c,e):return forum_snapshot(c,e)


@app.post('/api/v1/forum/posts')
def publish_forum_post(body:ForumContent,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return create_post(c,e,body.body)


@app.post('/api/v1/forum/posts/{post_id}/comments')
def comment_forum_post(post_id:str,body:ForumContent,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return change_post(c,e,post_id,'comment',body=body.body)


@app.put('/api/v1/forum/posts/{post_id}/reaction')
def react_forum_post(post_id:str,body:ForumPreference,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return change_post(c,e,post_id,'reaction',active=body.active)


@app.put('/api/v1/forum/posts/{post_id}/favorite')
def favorite_forum_post(post_id:str,body:ForumPreference,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return change_post(c,e,post_id,'favorite',active=body.active)


@app.post('/api/v1/forum/conversations/{conversation_id}/messages')
def message_forum_conversation(conversation_id:str,body:ForumContent,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return send_message(c,e,conversation_id,body.body)


async def forum_multipart(request,kind,parent_id,body,files):
    from ..forum import require_access
    employee=resolve_employee(request)
    def check():
        with transaction(employee.employee_id,Purpose.FORUM_WRITE) as c:require_access(c,employee,operation='write')
    await run_in_threadpool(check)
    if not files or len(files)>FORUM_MAX_FILES:raise HTTPException(422,detail={'code':'FORUM_ATTACHMENT_COUNT'})
    form=await request.form()
    if set(form.keys())-{'body','files'}:raise HTTPException(422,detail={'code':'INVALID_FORUM_ATTACHMENT_FIELDS'})
    incoming=[];total=0
    for file in files:
        try:raw=await file.read(FORUM_MAX_BYTES+1)
        finally:await file.close()
        total+=len(raw)
        if total>FORUM_MAX_BYTES:raise HTTPException(413,detail={'code':'FORUM_ATTACHMENT_SIZE'})
        incoming.append(IncomingAttachment(file.filename or '',file.content_type or 'application/octet-stream',raw))
    return await run_in_threadpool(publish_forum_attachment,employee,kind,parent_id,body,incoming)


@app.post('/api/v1/forum/posts/attachments')
async def forum_post_files(request:Request,body:str=Form(default='',max_length=10000),files:list[UploadFile]=File()):
    return await forum_multipart(request,'post',None,body,files)


@app.post('/api/v1/forum/posts/{post_id}/comments/attachments')
async def forum_comment_files(post_id:str,request:Request,body:str=Form(default='',max_length=10000),files:list[UploadFile]=File()):
    return await forum_multipart(request,'comment',post_id,body,files)


@app.post('/api/v1/forum/conversations/{conversation_id}/messages/attachments')
async def forum_message_files(conversation_id:str,request:Request,body:str=Form(default='',max_length=10000),files:list[UploadFile]=File()):
    return await forum_multipart(request,'message',conversation_id,body,files)


@app.get('/api/v1/forum/attachments/{attachment_id}/download')
def forum_file_download(attachment_id:str,request:Request):
    with authorized(request,Purpose.FORUM_READ) as (c,e):
        path,filename,media_type=download_forum_attachment(c,e,attachment_id)
        return FileResponse(path,media_type=media_type,filename=filename,content_disposition_type='attachment',headers={'Content-Security-Policy':'sandbox'})

@app.post('/api/v1/cases')
def register_case(body:NewCase,request:Request):
    with authorized(request,Purpose.CASE_WRITE) as (c,e):return create_case(c,e,body.model_dump())

@app.post('/api/v1/cases/{case_id}/successor')
def successive_case(case_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.CASE_WRITE) as (c,e):return create_case(c,e,{'existingCaseId':case_id,'source':body.reason})

@app.post('/api/v1/forms')
def form_save(body:FormSave,request:Request):
    with authorized(request,Purpose.FORM_WRITE) as (c,e):return save_form(c,e,body.model_dump(exclude_none=True))

@app.put('/api/v1/cases/{case_id}/roadmap')
def roadmap_save(case_id:str,body:RoadmapUpdate,request:Request):
    with authorized(request,Purpose.ROADMAP) as (c,e):return update_roadmap(c,e,case_id,[g.model_dump(exclude_none=True) for g in body.goals],body.notes,body.expected_version)

@app.post('/api/v1/cases/{case_id}/observations')
def observation_save(case_id:str,body:ObservationInput,request:Request):
    with authorized(request,Purpose.CASE_WRITE) as (c,e):return add_observation(c,e,case_id,body.note,body.category)

@app.patch('/api/v1/cases/{case_id}/identity')
def identity_save(case_id:str,body:IdentityUpdate,request:Request):
    with authorized(request,'child.identity.write') as (c,e):return ChildIdentityService(c,e).update(case_id,body.changes.model_dump(exclude_none=True))

@app.get('/api/v1/cases/{case_id}/identity')
def identity_read(case_id:str,request:Request):
    with authorized(request,'child.identity.read') as (c,e):return ChildIdentityService(c,e).read(case_id)

@app.post('/api/v1/records/{kind}')
def save_record(kind:Literal['tasks','appointments'],body:RecordInput,request:Request):
    from sqlalchemy import text
    from ..seed import record
    with authorized(request,Purpose.CASE_WRITE) as (c,e):
        policy=AuthorizationService(c,e);policy.require_case(body.caseId,'administrative','write')
        old=one(c,f'SELECT case_id FROM {kind} WHERE id=:id',id=body.id)
        if old and old['case_id']!=body.caseId:policy.deny('record')
        p=body.model_dump(exclude_none=True);p['professionalId']=e.employee_id
        if old:c.execute(text(f'UPDATE {kind} SET payload=CAST(:p AS jsonb),author_id=:e,version=version+1 WHERE id=:id'),{'p':__import__('json').dumps(p),'e':e.employee_id,'id':body.id})
        else:record(c,kind,body.id,body.caseId,p,'administrative',e.employee_id)
        audit(c,e.employee_id,kind+'.save',kind,body.id)
        return {'id':body.id}

@app.put('/api/v1/sessions/{session_id}')
def update_session(session_id:str,body:SessionUpdate,request:Request):
    import json
    from sqlalchemy import text
    with authorized(request,Purpose.CASE_WRITE) as (c,e):
        policy=AuthorizationService(c,e);old=one(c,'SELECT * FROM activity_sessions WHERE id=:id',id=session_id)
        if not old or old['author_id']!=e.employee_id or body.id!=session_id or body.activityId!=old['activity_id']:policy.deny('session')
        before=rows(c,'SELECT case_id FROM session_participants WHERE session_id=:id',id=session_id)
        if set(p.caseId for p in body.participants)!=set(p['case_id'] for p in before):raise HTTPException(422,'PARTICIPANTS_UNCHANGED_REQUIRED')
        for p in body.participants:
            policy.require_case(p.caseId,'educational','write')
            if body.status=='completed' and p.attendance=='present' and not p.observations.strip():raise HTTPException(422,'OBSERVATION_REQUIRED')
            c.execute(text('UPDATE session_participants SET payload=CAST(:p AS jsonb) WHERE session_id=:id AND case_id=:case'),{'p':p.model_dump_json(),'id':session_id,'case':p.caseId})
        payload=body.model_dump(exclude={'participants'},exclude_none=True);payload['educatorId']=e.employee_id
        c.execute(text('UPDATE activity_sessions SET payload=CAST(:p AS jsonb),status=:s WHERE id=:id'),{'p':json.dumps(payload),'s':body.status,'id':session_id})
        audit(c,e.employee_id,'session.update','session',session_id)
        return {'id':session_id}

@app.get('/api/v1/browser/suggestions')
@app.get('/api/v1/search')
def text_search(request:Request,q:str='',category:str='all'):
    if len(q)>300:raise HTTPException(422,'QUERY_TOO_LONG')
    with authorized(request,Purpose.BROWSER) as (c,e):return AuthorizedRetrievalService(c,e).text_search(q,category)

@app.post('/api/v1/search')
def private_text_search(body:SearchInput,request:Request):
    with authorized(request,Purpose.BROWSER) as (c,e):return AuthorizedRetrievalService(c,e).text_search(body.q,body.category)

@app.post('/api/v1/browser/search')
@app.post('/api/v1/browser/ask')
def browser_ask(body:BrowserQuestion,request:Request):return IntelligentBrowserService().ask(resolve_employee(request),body.model_dump())

@app.get('/api/v1/cases/{case_id}/recommendation-templates')
def templates(case_id:str,request:Request):
    with authorized(request,Purpose.RECOMMENDATION) as (c,e):return {'templates':[r['payload'] for r in available_templates(c,e,case_id)]}

@app.post('/api/v1/recommendations')
@app.post('/api/v1/recommendations/generate')
def generate_recommendations(body:RecommendationInput,request:Request):return central_recommendation_engine.generate(resolve_employee(request),body.model_dump())

@app.post('/api/v1/recommendations/{candidate_id}/feedback')
def save_feedback(candidate_id:str,body:Feedback,request:Request):
    with authorized(request,Purpose.FEEDBACK) as (c,e):return central_recommendation_engine.feedback(c,e,candidate_id,body.status,body.reason)

@app.post('/api/v1/cases/{case_id}/planned-interventions')
def plan(case_id:str,body:Plan,request:Request):
    with authorized(request,Purpose.ROADMAP) as (c,e):return plan_intervention(c,e,case_id,body.model_dump())

@app.get('/api/v1/ai/status')
def ai_status(request:Request):
    resolve_employee(request)
    try:result=gateway.request('/internal/models/status')
    except LocalModelError:result={'models':{},'status':'gateway_unavailable'}
    return {'mode':settings.ai_mode,'device':'CPU','external_fallback':False,**result}

@app.post('/api/v1/documents/upload')
async def upload_document(request:Request,file:UploadFile=File(),case_id:str=Form(),category:Literal['social','educational','psychological','assessment','administrative']=Form(),title:str=Form(max_length=150),language:Literal['ar','fr']=Form()):
    raw=await file.read(8*1024*1024+1)
    with authorized(request,Purpose.FORM_WRITE) as (c,e):return register_upload(c,e,case_id,category,title,language,raw,file.content_type)

@app.post('/api/v1/document-versions/{version_id}/approve')
def approve_document(version_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.FORM_WRITE) as (c,e):return approve(c,e,version_id,body.reason)

@app.get('/api/v1/document-versions/{version_id}/original')
def original_document(version_id:str,request:Request):
    with authorized(request,Purpose.FORM_READ) as (c,e):
        version=one(c,'SELECT document_id FROM document_versions WHERE id=:id',id=version_id)
        if not version:AuthorizationService(c,e).deny('document')
        source=one(c,'SELECT storage_reference,content_type FROM protected_originals WHERE version_id=:id',id=version_id)
        if not source:raise HTTPException(404,detail={'code':'ORIGINAL_NOT_INDEXED_YET'})
        from ..documents import pseudonymous_source
        from fastapi.responses import PlainTextResponse
        content=pseudonymous_source(c,source)
        audit(c,e.employee_id,'document.pseudonymous_view','document_version',version_id)
        return PlainTextResponse(content,headers={'Content-Disposition':'inline; filename="MASAR-source.txt"'})


@app.post('/api/v1/group-assignments/{assignment_id}/revoke')
def revoke(assignment_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e): revoke_assignment(c,e,assignment_id,body.reason)
    return {'status':'REVOKED'}


@app.post('/api/v1/groups/{group_id}/children/{case_id}/end')
def remove_member(group_id:str,case_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e): end_membership(c,e,group_id,case_id,body.reason)
    return {'status':'ENDED'}

@app.get('/api/v1/groups/{group_id}/assignments')
def read_assignments(group_id:str,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e):
        policy=AuthorizationService(c,e);policy.require_group(group_id)
        if not policy.capability('assignments.manage'):policy.deny('assignment')
        return {'assignments':[dict(r) for r in rows(c,"SELECT a.id,a.employee_id,a.role_id,a.assignment_status,e.payload->'name' AS name FROM group_assignments a JOIN employees e ON e.id=a.employee_id WHERE a.group_id=:id ORDER BY a.id",id=group_id)]}

@app.post('/api/v1/groups/{group_id}/members')
def enroll_child(group_id:str,body:Enrollment,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e):return enroll(c,e,group_id,body.case_id,body.reason)
)
    values:dict[str,Any]
    status:Literal['draft','completed','validated']
    language:Literal['ar','fr']
class Goal(Payload):
    id:str=Field(max_length=100)
    skill:str=Field(max_length=100)
    description:ChildIdentity
    confirmed:bool
    dueDate:str=Field(max_length=10)
    confirmedBy:str|None=None
    confirmedAt:str|None=None
class RoadmapUpdate(Payload):
    goals:list[Goal]=Field(max_length=50)
    notes:str=Field(max_length=10000)
    expected_version:int=Field(ge=1)
class ObservationInput(Payload):
    note:str=Field(min_length=1,max_length=10000)
    category:Literal['social','educational','psychological','assessment']
class IdentityChanges(Payload):
    first_name:ChildIdentity|None=None
    last_name:ChildIdentity|None=None
    name:ChildIdentity|None=None
    birthDate:str|None=Field(default=None,pattern=r'^\d{4}-\d{2}-\d{2}$')
    birthplace:str|None=Field(default=None,max_length=300)
    gender:Literal['male','female']|None=None
    address:str|None=Field(default=None,max_length=1000)
    phone:str|None=Field(default=None,max_length=50)
    father:str|None=Field(default=None,max_length=150)
    mother:str|None=Field(default=None,max_length=150)
    school:str|None=Field(default=None,max_length=300)
    education:str|None=Field(default=None,max_length=300)
    preferences:list[str]|None=Field(default=None,max_length=30)
class IdentityUpdate(Payload):changes:IdentityChanges
class SummaryGeneration(Payload):
    cycle_id:int|None=Field(default=None,ge=1,le=1000)
    manual:dict[Literal['ar','fr'],str]|None=None
class SummaryReview(Reason):
    status:Literal['approved','rejected']
class BrowserQuestion(Payload):
    question:str=Field(min_length=2,max_length=1000)
    language:Literal['ar','fr']
    case_id:str|None=Field(default=None,max_length=64)
    group_id:str|None=Field(default=None,max_length=64)
    operation:Literal['group_count','pending_objectives','assessment_count','intervention_count']|None=None
class Constraints(Payload):
    maxDuration:int=Field(default=90,ge=5,le=240)
    format:Literal['any','individual','group']='any'
    participants:int=Field(default=1,ge=1,le=30)
    materials:list[str]=Field(default_factory=list,max_length=40)
class RecommendationInput(Payload):
    activityId:str|None=Field(default=None,max_length=80)
    contextId:str=Field(max_length=80)
    caseId:str=Field(max_length=64)
    language:Literal['ar','fr']
    goalIds:list[str]=Field(default_factory=list,max_length=50)
    groupId:str|None=None
    projectId:str|None=None
    workshopId:str|None=None
    constraints:Constraints=Field(default_factory=Constraints)
    request:str=Field(default='',max_length=500)
    additionalConstraints:str=Field(default='',max_length=500)
class Feedback(Reason):status:Literal['ACCEPTED','MODIFIED','REJECTED','DEFERRED']
class Plan(Reason):
    prerequisites_confirmed:Literal[True]
    intervention_id:str=Field(max_length=80)
    goal_ids:list[str]=Field(min_length=1,max_length=30)
    date:str=Field(pattern=r'^\d{4}-\d{2}-\d{2}$')
    idempotency_key:str=Field(pattern=r'^[a-zA-Z0-9-]{12,64}$')
class RecordInput(Payload):
    id:str=Field(max_length=100)
    caseId:str
    title:ChildIdentity
    professionalId:str
    completed:bool=False
    dueDate:str|None=None
    type:Literal['interview','evaluation','meeting','followUp']|None=None
    date:str|None=None
    time:str|None=None
    notes:str=Field(default='',max_length=5000)
class Participation(Payload):
    caseId:str
    attendance:Literal['present','absent','excused']
    engagement:Literal['active','partial','observing']
    observations:str=Field(max_length=5000)
    progress:str=Field(max_length=5000)
class SessionUpdate(Payload):
    id:str
    activityId:str
    date:str
    time:str
    educatorId:str
    group:str
    participants:list[Participation]=Field(min_length=1,max_length=30)
    status:Literal['planned','inProgress','completed','postponed','cancelled']
    adaptations:str=Field(max_length=5000)
    goalIds:list[str]
    recommendationId:str|None=None


def new_csrf(response):
    nonce=secrets.token_urlsafe(24)
    value=nonce+'.'+hmac.new(settings.secret.encode(),nonce.encode(),'sha256').hexdigest()
    response.set_cookie('masar_csrf',value,httponly=True,secure=settings.cookie_secure,samesite='strict',max_age=28800)
    return value


@app.middleware('http')
async def security(request,call_next):
    key=hashlib.sha256((request.cookies.get('masar_session') or (request.client.host if request.client else 'local')).encode()).hexdigest()
    now=time.monotonic(); queue=rate[key]
    while queue and queue[0]<now-60: queue.popleft()
    if len(queue)>=240: return JSONResponse({'detail':{'code':'RATE_LIMIT'}},429)
    queue.append(now)
    if len(rate)>4096:
        for k in list(rate)[:2048]:
            if not rate[k] or rate[k][-1]<now-60: del rate[k]
    try:length=int(request.headers.get('content-length','0'))
    except ValueError:return JSONResponse({'detail':{'code':'INVALID_CONTENT_LENGTH'}},400)
    if length>9*1024*1024: return JSONResponse({'detail':{'code':'PAYLOAD_TOO_LARGE'}},413)
    if request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('origin')
        if origin and origin not in settings.origins: return JSONResponse({'detail':{'code':'ORIGIN_DENIED'}},403)
        cookie=request.cookies.get('masar_csrf',''); header=request.headers.get('x-masar-csrf','')
        parts=cookie.rsplit('.',1)
        valid=len(parts)==2 and hmac.compare_digest(parts[1],hmac.new(settings.secret.encode(),parts[0].encode(),'sha256').hexdigest())
        if not valid or not hmac.compare_digest(cookie,header): return JSONResponse({'detail':{'code':'CSRF_REQUIRED'}},403)
    response=await call_next(request)
    # Final defence for every JSON API, including notifications, Forum and errors.
    # Identity is returned exclusively by the explicit, separately authorized GET.
    identity_read=request.method=='GET' and re.fullmatch(r'/api/v1/cases/[^/]+/identity',request.url.path)
    if 'application/json' in response.headers.get('content-type','') and not identity_read:
        raw=b''.join([chunk async for chunk in response.body_iterator])
        value=json.loads(raw)
        try:
            def protect():
                try:actor=resolve_employee(request).employee_id
                except HTTPException:actor=None
                with transaction(actor,Purpose.CASE_READ) as privacy_db:
                    projected=ChildPrivacyService(privacy_db).project(value)
                    if request.method=='GET' and request.url.path=='/api/v1/entry/governorates' and response.status_code==200:
                        projected=preserve_governorate_labels(value,projected)
                    return projected
            value=await run_in_threadpool(protect)
        except DBAPIError:
            return JSONResponse({'detail':{'code':'PRIVACY_PROJECTION_UNAVAILABLE'}},503,headers={'Cache-Control':'no-store'})
        cookies=[(k,v) for k,v in response.raw_headers if k.lower()==b'set-cookie']
        response=JSONResponse(value,status_code=response.status_code,headers={k:v for k,v in response.headers.items() if k.lower() not in ('content-length','content-type','set-cookie')})
        response.raw_headers.extend(cookies)
    if response.status_code in (401,403,404,409,422):
        try:
            try:employee=resolve_employee(request).employee_id
            except HTTPException:employee=None
            with transaction(employee,'audit.read') as c:audit(c,employee,'request.denied','api',getattr(request.scope.get('route'),'path','unmatched'),success=False,status_code=response.status_code)
        except DBAPIError:pass
    response.headers['Cache-Control']='no-store'
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Referrer-Policy']='same-origin'
    return response


@app.exception_handler(DBAPIError)
async def database_error(request,error):
    return JSONResponse({'detail':{'code':'DATABASE_OPERATION_REFUSED'}},409)

@app.exception_handler(ValueError)
async def invalid_business_value(request,error):
    return JSONResponse({'detail':{'code':'INVALID_BUSINESS_VALUE'}},422)


@contextmanager
def authorized(request,purpose):
    employee=resolve_employee(request)
    with transaction(employee.employee_id,purpose) as c:
        yield c,employee


@app.get('/api/v1/health')
def health():
    with transaction() as c: one(c,'SELECT 1 AS ok')
    return {'status':'ok','identity_mode':settings.identity_mode,'ai_mode':settings.ai_mode,'synthetic_only':True}


@app.get('/api/v1/bootstrap')
def bootstrap(response: Response):
    with transaction() as c:
        centres=[centre for g in governorates(c) for centre in public_centres(c,g['id'])]
    return {'professionals':[],'centers':centres,'csrf_token':new_csrf(response),'identity_mode':settings.identity_mode,'features':{'professionalNetwork':settings.professional_network,'laterLifecycle':False}}


@app.get('/api/v1/entry/governorates')
def entry_governorates():
    with transaction() as c:return governorates(c)


@app.get('/api/v1/entry/governorates/{governorate_id}/centres')
def entry_centres(governorate_id:str=Path(pattern=r'^TN-\d{2}$')):
    with transaction() as c:return public_centres(c,governorate_id)


@app.get('/api/v1/auth/demo/professionals')
def entry_profiles(governorate_id:str=Query(pattern=r'^TN-\d{2}$'),centre_id:str=Query(min_length=1,max_length=64)):
    with transaction() as c:return demo_profiles(c,governorate_id,centre_id)


@app.post('/api/v1/auth/demo/login')
def login(body: DemoLogin,response:Response):
    token=DemoIdentityProvider().establish_session(body.employee_id,body.governorate_id,body.centre_id)
    response.set_cookie('masar_session',token,httponly=True,secure=settings.cookie_secure,samesite='strict',max_age=28800)
    with transaction(body.employee_id,'identity') as c: audit(c,body.employee_id,'session.start','session')
    return {'csrf_token':new_csrf(response),'mode':'demo'}


@app.post('/api/v1/auth/logout')
def logout(request:Request,response:Response):
    with transaction() as c: one(c,'SELECT authz.revoke_session(:hash)',hash=token_hash(request.cookies.get('masar_session','')))
    response.delete_cookie('masar_session')
    return {'csrf_token':new_csrf(response)}


def employee_view(c,e):
    professional=one(c,'SELECT payload FROM employees WHERE id=:id',id=e.employee_id)['payload']
    choices=authorized_centres(c,e.employee_id)
    centres=[r['id'] for r in choices]
    current=one(c,'SELECT authz.session_entry_centre(CAST(:session AS uuid)) AS id',session=e.session_id)['id']
    selected=current if current in centres else next(iter(centres),None)
    professional={**professional,'centerId':selected or professional['centerId']}
    roles=[r['role_id'] for r in rows(c,'SELECT role_id FROM employee_roles WHERE employee_id=:id',id=e.employee_id)]
    return {'employeeId':e.employee_id,'centreIds':centres,'centres':choices,'selectedCentreId':selected,'roles':roles,'active':True,'sessionId':e.session_id,'professional':professional,'capabilities':[r['permission'] for r in rows(c,'SELECT DISTINCT permission FROM role_permissions WHERE authz.capability(permission)')]}


@app.post('/api/v1/auth/centre')
def change_session_centre(body:Workplace,request:Request):
    with authorized(request,'identity') as (c,e):return select_centre(c,e,body.governorate_id,body.centre_id)


@app.get('/api/v1/me')
def me(request:Request):
    with authorized(request,'identity') as (c,e): return employee_view(c,e)


@app.get('/api/v1/me/assigned-groups')
def my_groups(request:Request):
    with authorized(request,Purpose.GROUP_READ) as (c,e): return {'groups':assigned_groups(c,e)}


@app.get('/api/v1/groups/{group_id}/children')
def group_children(group_id:str,request:Request):
    with authorized(request,Purpose.GROUP_READ) as (c,e): return roster(c,e,group_id)


@app.get('/api/v1/cases/{case_id}')
def child_folder(case_id:str,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        AuthorizationService(c,e).require_case(case_id)
        audit(c,e.employee_id,'case.read','case',case_id)
        data=workspace(c,e)
        return {'case':next(x for x in data['cases'] if x['id']==case_id),'child':next(x for x in data['children'] if x['id']==next(x['childId'] for x in data['cases'] if x['id']==case_id)),'observations':[x for x in data['events'] if x['caseId']==case_id],'documents':[x for x in data['submissions'] if x['caseId']==case_id]}

@app.get('/api/v1/cases/{case_id}/access')
def child_folder_access(case_id:str,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        AuthorizationService(c,e).require_active_session();AuthorizationService(c,e).require_case(case_id)
        audit(c,e.employee_id,'case.open','case',case_id)
        return {'case_id':case_id,'allowed':True}

@app.get('/api/v1/workspace')
def read_workspace(request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):data=workspace(c,e)
    if settings.professional_network:
        with transaction(e.employee_id,Purpose.FORUM_READ) as c:data.update(forum_snapshot(c,e))
    return data

@app.get('/api/v1/exports/workspace')
def export_workspace(request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        AuthorizationService(c,e).require_active_session()
        data=workspace(c,e)
        audit(c,e.employee_id,'export.workspace','authorized_scope',case_count=len(data['cases']))
        return data

@app.post('/api/v1/exports/cases')
def export_case_codes(body:CaseExport,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):
        policy=AuthorizationService(c,e);policy.require_active_session()
        for key in set(body.case_ids):policy.require_case(key)
        result=[dict(r) for r in rows(c,"SELECT ca.id,ch.child_code,(ca.payload->>'stage')::integer AS stage,ca.payload->>'status' AS status FROM cases ca JOIN children ch ON ch.id=ca.child_id WHERE ca.id=ANY(:ids) ORDER BY ca.id",ids=body.case_ids)]
        audit(c,e.employee_id,'export.cases','authorized_scope',case_count=len(result))
        return {'cases':result}

@app.get('/api/v1/cases/{case_id}/forms/{form_id}/access')
def form_export_access(case_id:str,form_id:str,request:Request,version_id:str|None=Query(default=None,max_length=100)):
    with authorized(request,Purpose.FORM_READ) as (c,e):
        policy=AuthorizationService(c,e);policy.require_active_session();policy.require_case(case_id)
        form=one(c,'SELECT category FROM form_definitions WHERE id=:id',id=form_id)
        if not form or not one(c,"SELECT authz.record_allowed(:case,:cat,:s,:id,'read') AS ok",case=case_id,cat=form['category'],s=3 if form['category']=='psychological' else 1,id=case_id+'-'+form_id)['ok']:policy.deny('form')
        if version_id and not one(c,'SELECT id FROM document_versions WHERE id=:id AND case_id=:case AND form_id=:form',id=version_id,case=case_id,form=form_id):policy.deny('document')
        audit(c,e.employee_id,'export.form','case',case_id,form_id=form_id)
        return {'allowed':True}


@app.get('/api/v1/journeys/assigned')
def assigned_journeys(request:Request,q:str=Query(default='',max_length=200),group_id:str|None=Query(default=None,max_length=64)):
    with authorized(request,Purpose.CASE_READ) as (c,e):return journey_overview(c,e,q,group_id)


@app.get('/api/v1/cases/{case_id}/journey')
def case_journey(case_id:str,request:Request):
    with authorized(request,Purpose.CASE_READ) as (c,e):return read_journey(c,e,case_id)


@app.get('/api/v1/cases/{case_id}/journey/stages/{stage_id}')
def case_journey_stage(case_id:str,request:Request,stage_id:int=Path(ge=1,le=5)):
    with authorized(request,Purpose.CASE_READ) as (c,e):return read_journey(c,e,case_id,stage_id)


@app.get('/api/v1/cases/{case_id}/journey/documents/{version_id}/open')
def journey_document_open(case_id:str,version_id:str,request:Request):
    with authorized(request,Purpose.FORM_READ) as (c,e):return open_journey_document(c,e,case_id,version_id)

@app.get('/api/v1/cases/{case_id}/journey/summaries')
def journey_summary_cards(case_id:str,request:Request):
    with authorized(request,'journey.summary.read') as (c,e):return journey_summary_service.cards(c,e,case_id)

@app.post('/api/v1/cases/{case_id}/journey/summaries/stages/{stage_id}')
def generate_journey_summary(case_id:str,body:SummaryGeneration,request:Request,stage_id:int=Path(ge=1,le=5)):
    if body.manual and (set(body.manual)!={'ar','fr'} or any(not v.strip() or len(v)>2000 for v in body.manual.values())):raise HTTPException(422,detail={'code':'INVALID_MANUAL_SUMMARY'})
    return journey_summary_service.generate(resolve_employee(request),case_id,stage_id,body.cycle_id,body.manual)

@app.get('/api/v1/cases/{case_id}/journey/summaries/stages/{stage_id}/history')
def journey_summary_history(case_id:str,request:Request,stage_id:int=Path(ge=1,le=5),cycle_id:int|None=Query(default=None,ge=1,le=1000)):
    with authorized(request,'journey.summary.read') as (c,e):return journey_summary_service.history(c,e,case_id,stage_id,cycle_id)

@app.get('/api/v1/cases/{case_id}/journey/summaries/stages/{stage_id}/sources')
def journey_summary_sources(case_id:str,request:Request,stage_id:int=Path(ge=1,le=5),summary_id:str|None=Query(default=None,max_length=80),source_kind:str|None=Query(default=None,max_length=40),source_id:str|None=Query(default=None,max_length=100)):
    with authorized(request,'journey.summary.read') as (c,e):
        result=journey_summary_service.evidence(c,e,case_id,summary_id,stage_id)
        if source_id or source_kind:
            if not any(s['kind']==source_kind and s['id']==source_id for s in result['sources']):AuthorizationService(c,e).deny('journey_evidence')
            if source_kind=='document_versions':return open_journey_document(c,e,case_id,source_id)
            return {'path':'/cases/'+case_id+'?tab='+('project' if source_kind in ('roadmap_objectives','roadmap_versions') else 'activities' if source_kind=='activity_sessions' else 'history')}
        return result

@app.post('/api/v1/cases/{case_id}/journey/summaries/{summary_id}/review')
def review_journey_summary(case_id:str,summary_id:str,body:SummaryReview,request:Request):
    with authorized(request,'journey.summary.review') as (c,e):return journey_summary_service.review(c,e,case_id,summary_id,body.status,body.reason)


@app.get('/api/v1/forum')
def read_forum(request:Request):
    with authorized(request,Purpose.FORUM_READ) as (c,e):return forum_snapshot(c,e)


@app.post('/api/v1/forum/posts')
def publish_forum_post(body:ForumContent,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return create_post(c,e,body.body)


@app.post('/api/v1/forum/posts/{post_id}/comments')
def comment_forum_post(post_id:str,body:ForumContent,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return change_post(c,e,post_id,'comment',body=body.body)


@app.put('/api/v1/forum/posts/{post_id}/reaction')
def react_forum_post(post_id:str,body:ForumPreference,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return change_post(c,e,post_id,'reaction',active=body.active)


@app.put('/api/v1/forum/posts/{post_id}/favorite')
def favorite_forum_post(post_id:str,body:ForumPreference,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return change_post(c,e,post_id,'favorite',active=body.active)


@app.post('/api/v1/forum/conversations/{conversation_id}/messages')
def message_forum_conversation(conversation_id:str,body:ForumContent,request:Request):
    with authorized(request,Purpose.FORUM_WRITE) as (c,e):return send_message(c,e,conversation_id,body.body)


async def forum_multipart(request,kind,parent_id,body,files):
    from ..forum import require_access
    employee=resolve_employee(request)
    def check():
        with transaction(employee.employee_id,Purpose.FORUM_WRITE) as c:require_access(c,employee,operation='write')
    await run_in_threadpool(check)
    if not files or len(files)>FORUM_MAX_FILES:raise HTTPException(422,detail={'code':'FORUM_ATTACHMENT_COUNT'})
    form=await request.form()
    if set(form.keys())-{'body','files'}:raise HTTPException(422,detail={'code':'INVALID_FORUM_ATTACHMENT_FIELDS'})
    incoming=[];total=0
    for file in files:
        try:raw=await file.read(FORUM_MAX_BYTES+1)
        finally:await file.close()
        total+=len(raw)
        if total>FORUM_MAX_BYTES:raise HTTPException(413,detail={'code':'FORUM_ATTACHMENT_SIZE'})
        incoming.append(IncomingAttachment(file.filename or '',file.content_type or 'application/octet-stream',raw))
    return await run_in_threadpool(publish_forum_attachment,employee,kind,parent_id,body,incoming)


@app.post('/api/v1/forum/posts/attachments')
async def forum_post_files(request:Request,body:str=Form(default='',max_length=10000),files:list[UploadFile]=File()):
    return await forum_multipart(request,'post',None,body,files)


@app.post('/api/v1/forum/posts/{post_id}/comments/attachments')
async def forum_comment_files(post_id:str,request:Request,body:str=Form(default='',max_length=10000),files:list[UploadFile]=File()):
    return await forum_multipart(request,'comment',post_id,body,files)


@app.post('/api/v1/forum/conversations/{conversation_id}/messages/attachments')
async def forum_message_files(conversation_id:str,request:Request,body:str=Form(default='',max_length=10000),files:list[UploadFile]=File()):
    return await forum_multipart(request,'message',conversation_id,body,files)


@app.get('/api/v1/forum/attachments/{attachment_id}/download')
def forum_file_download(attachment_id:str,request:Request):
    with authorized(request,Purpose.FORUM_READ) as (c,e):
        path,filename,media_type=download_forum_attachment(c,e,attachment_id)
        return FileResponse(path,media_type=media_type,filename=filename,content_disposition_type='attachment',headers={'Content-Security-Policy':'sandbox'})

@app.post('/api/v1/cases')
def register_case(body:NewCase,request:Request):
    with authorized(request,Purpose.CASE_WRITE) as (c,e):return create_case(c,e,body.model_dump())

@app.post('/api/v1/cases/{case_id}/successor')
def successive_case(case_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.CASE_WRITE) as (c,e):return create_case(c,e,{'existingCaseId':case_id,'source':body.reason})

@app.post('/api/v1/forms')
def form_save(body:FormSave,request:Request):
    with authorized(request,Purpose.FORM_WRITE) as (c,e):return save_form(c,e,body.model_dump(exclude_none=True))

@app.put('/api/v1/cases/{case_id}/roadmap')
def roadmap_save(case_id:str,body:RoadmapUpdate,request:Request):
    with authorized(request,Purpose.ROADMAP) as (c,e):return update_roadmap(c,e,case_id,[g.model_dump(exclude_none=True) for g in body.goals],body.notes,body.expected_version)

@app.post('/api/v1/cases/{case_id}/observations')
def observation_save(case_id:str,body:ObservationInput,request:Request):
    with authorized(request,Purpose.CASE_WRITE) as (c,e):return add_observation(c,e,case_id,body.note,body.category)

@app.patch('/api/v1/cases/{case_id}/identity')
def identity_save(case_id:str,body:IdentityUpdate,request:Request):
    with authorized(request,'child.identity.write') as (c,e):return ChildIdentityService(c,e).update(case_id,body.changes.model_dump(exclude_none=True))

@app.get('/api/v1/cases/{case_id}/identity')
def identity_read(case_id:str,request:Request):
    with authorized(request,'child.identity.read') as (c,e):return ChildIdentityService(c,e).read(case_id)

@app.post('/api/v1/records/{kind}')
def save_record(kind:Literal['tasks','appointments'],body:RecordInput,request:Request):
    from sqlalchemy import text
    from ..seed import record
    with authorized(request,Purpose.CASE_WRITE) as (c,e):
        policy=AuthorizationService(c,e);policy.require_case(body.caseId,'administrative','write')
        old=one(c,f'SELECT case_id FROM {kind} WHERE id=:id',id=body.id)
        if old and old['case_id']!=body.caseId:policy.deny('record')
        p=body.model_dump(exclude_none=True);p['professionalId']=e.employee_id
        if old:c.execute(text(f'UPDATE {kind} SET payload=CAST(:p AS jsonb),author_id=:e,version=version+1 WHERE id=:id'),{'p':__import__('json').dumps(p),'e':e.employee_id,'id':body.id})
        else:record(c,kind,body.id,body.caseId,p,'administrative',e.employee_id)
        audit(c,e.employee_id,kind+'.save',kind,body.id)
        return {'id':body.id}

@app.put('/api/v1/sessions/{session_id}')
def update_session(session_id:str,body:SessionUpdate,request:Request):
    import json
    from sqlalchemy import text
    with authorized(request,Purpose.CASE_WRITE) as (c,e):
        policy=AuthorizationService(c,e);old=one(c,'SELECT * FROM activity_sessions WHERE id=:id',id=session_id)
        if not old or old['author_id']!=e.employee_id or body.id!=session_id or body.activityId!=old['activity_id']:policy.deny('session')
        before=rows(c,'SELECT case_id FROM session_participants WHERE session_id=:id',id=session_id)
        if set(p.caseId for p in body.participants)!=set(p['case_id'] for p in before):raise HTTPException(422,'PARTICIPANTS_UNCHANGED_REQUIRED')
        for p in body.participants:
            policy.require_case(p.caseId,'educational','write')
            if body.status=='completed' and p.attendance=='present' and not p.observations.strip():raise HTTPException(422,'OBSERVATION_REQUIRED')
            c.execute(text('UPDATE session_participants SET payload=CAST(:p AS jsonb) WHERE session_id=:id AND case_id=:case'),{'p':p.model_dump_json(),'id':session_id,'case':p.caseId})
        payload=body.model_dump(exclude={'participants'},exclude_none=True);payload['educatorId']=e.employee_id
        c.execute(text('UPDATE activity_sessions SET payload=CAST(:p AS jsonb),status=:s WHERE id=:id'),{'p':json.dumps(payload),'s':body.status,'id':session_id})
        audit(c,e.employee_id,'session.update','session',session_id)
        return {'id':session_id}

@app.get('/api/v1/browser/suggestions')
@app.get('/api/v1/search')
def text_search(request:Request,q:str='',category:str='all'):
    if len(q)>300:raise HTTPException(422,'QUERY_TOO_LONG')
    with authorized(request,Purpose.BROWSER) as (c,e):return AuthorizedRetrievalService(c,e).text_search(q,category)

@app.post('/api/v1/search')
def private_text_search(body:SearchInput,request:Request):
    with authorized(request,Purpose.BROWSER) as (c,e):return AuthorizedRetrievalService(c,e).text_search(body.q,body.category)

@app.post('/api/v1/browser/search')
@app.post('/api/v1/browser/ask')
def browser_ask(body:BrowserQuestion,request:Request):return IntelligentBrowserService().ask(resolve_employee(request),body.model_dump())

@app.get('/api/v1/cases/{case_id}/recommendation-templates')
def templates(case_id:str,request:Request):
    with authorized(request,Purpose.RECOMMENDATION) as (c,e):return {'templates':[r['payload'] for r in available_templates(c,e,case_id)]}

@app.post('/api/v1/recommendations')
@app.post('/api/v1/recommendations/generate')
def generate_recommendations(body:RecommendationInput,request:Request):return central_recommendation_engine.generate(resolve_employee(request),body.model_dump())

@app.post('/api/v1/recommendations/{candidate_id}/feedback')
def save_feedback(candidate_id:str,body:Feedback,request:Request):
    with authorized(request,Purpose.FEEDBACK) as (c,e):return central_recommendation_engine.feedback(c,e,candidate_id,body.status,body.reason)

@app.post('/api/v1/cases/{case_id}/planned-interventions')
def plan(case_id:str,body:Plan,request:Request):
    with authorized(request,Purpose.ROADMAP) as (c,e):return plan_intervention(c,e,case_id,body.model_dump())

@app.get('/api/v1/ai/status')
def ai_status(request:Request):
    resolve_employee(request)
    try:result=gateway.request('/internal/models/status')
    except LocalModelError:result={'models':{},'status':'gateway_unavailable'}
    return {'mode':settings.ai_mode,'device':'CPU','external_fallback':False,**result}

@app.post('/api/v1/documents/upload')
async def upload_document(request:Request,file:UploadFile=File(),case_id:str=Form(),category:Literal['social','educational','psychological','assessment','administrative']=Form(),title:str=Form(max_length=150),language:Literal['ar','fr']=Form()):
    raw=await file.read(8*1024*1024+1)
    with authorized(request,Purpose.FORM_WRITE) as (c,e):return register_upload(c,e,case_id,category,title,language,raw,file.content_type)

@app.post('/api/v1/document-versions/{version_id}/approve')
def approve_document(version_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.FORM_WRITE) as (c,e):return approve(c,e,version_id,body.reason)

@app.get('/api/v1/document-versions/{version_id}/original')
def original_document(version_id:str,request:Request):
    with authorized(request,Purpose.FORM_READ) as (c,e):
        version=one(c,'SELECT document_id FROM document_versions WHERE id=:id',id=version_id)
        if not version:AuthorizationService(c,e).deny('document')
        source=one(c,'SELECT storage_reference,content_type FROM protected_originals WHERE version_id=:id',id=version_id)
        if not source:raise HTTPException(404,detail={'code':'ORIGINAL_NOT_INDEXED_YET'})
        from ..documents import pseudonymous_source
        from fastapi.responses import PlainTextResponse
        content=pseudonymous_source(c,source)
        audit(c,e.employee_id,'document.pseudonymous_view','document_version',version_id)
        return PlainTextResponse(content,headers={'Content-Disposition':'inline; filename="MASAR-source.txt"'})


@app.post('/api/v1/group-assignments/{assignment_id}/revoke')
def revoke(assignment_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e): revoke_assignment(c,e,assignment_id,body.reason)
    return {'status':'REVOKED'}


@app.post('/api/v1/groups/{group_id}/children/{case_id}/end')
def remove_member(group_id:str,case_id:str,body:Reason,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e): end_membership(c,e,group_id,case_id,body.reason)
    return {'status':'ENDED'}

@app.get('/api/v1/groups/{group_id}/assignments')
def read_assignments(group_id:str,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e):
        policy=AuthorizationService(c,e);policy.require_group(group_id)
        if not policy.capability('assignments.manage'):policy.deny('assignment')
        return {'assignments':[dict(r) for r in rows(c,"SELECT a.id,a.employee_id,a.role_id,a.assignment_status,e.payload->'name' AS name FROM group_assignments a JOIN employees e ON e.id=a.employee_id WHERE a.group_id=:id ORDER BY a.id",id=group_id)]}

@app.post('/api/v1/groups/{group_id}/members')
def enroll_child(group_id:str,body:Enrollment,request:Request):
    with authorized(request,Purpose.GROUP_MANAGE) as (c,e):return enroll(c,e,group_id,body.case_id,body.reason)
