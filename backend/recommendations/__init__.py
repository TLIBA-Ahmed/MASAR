"""The single recommendation orchestrator. Feedback never changes a rehabilitation plan."""
import hashlib,json,uuid
from datetime import date
from ..db import transaction,one,rows
from ..authorization import AuthorizationService,Purpose
from ..retrieval import plain
from ..case_management import now,bi,error,event,uid
from ..seed import insert,record
from ..events import audit,publish
from ..ai_client import gateway,LocalModelError
from ..config import settings
from ..browser import unsafe
from ..privacy import ChildPrivacyService

def available_templates(c,e,case_id):
    policy=AuthorizationService(c,e);policy.require_case(case_id)
    return [r for r in rows(c,'SELECT * FROM recommendation_templates ORDER BY id') if policy.can_use_recommendation_template(case_id,r)]

def eligibility(item,goals,age,constraints,template):
    p=item['payload'];strategy=template['payload']['recommendationStrategy'];skills={g['skill'] for g in goals}
    if not item['active'] or item['approval_status'] not in ('APPROVED','DEMO_APPROVED'):return False
    if item['kind']=='resource':
        if strategy=='activities':return False
        domains=set(p.get('domains',[]))
        target={'social':{'social','coordination'},'family':{'family'},'orientation':{'orientation'},'documents':{'administration'},'deadlines':{'administration'},'coordination':{'administration','coordination'},'support':{'psychology','support'},'training':{'training'},'resources':{'education','training','support'}}.get(strategy,set())
        return bool((not target or target&domains) and (not skills or skills&set(p['skills']) or strategy in ('documents','deadlines','coordination')))
    if strategy not in ('activities','project','training','support'):return False
    return bool(skills&set(p['skills']) and p['minAge']<=age<=p['maxAge'] and p['duration']<=constraints['maxDuration'] and (constraints['format']=='any' or p['format']==constraints['format']) and p['minParticipants']<=constraints['participants']<=p['maxParticipants'] and (set(p['materials'])-{'none'})<=set(constraints['materials']))

class CentralRecommendationEngine:
    def generate(self,e,body):
        case_id=body['caseId'];template_id=body['contextId'];language=body['language']
        if unsafe(body.get('request','')+' '+body.get('additionalConstraints','')):return {'status':'abstained','recommendations':[],'limitations':['UNSUPPORTED_REQUEST']}
        with transaction(e.employee_id,Purpose.RECOMMENDATION) as c:
            policy=AuthorizationService(c,e);templates=available_templates(c,e,case_id);template=next((t for t in templates if t['id']==template_id),None)
            if not template:policy.deny('template')
            if body.get('groupId'):policy.require_group(body['groupId'])
            if body.get('groupId') and not one(c,"SELECT id FROM child_group_memberships WHERE group_id=:group AND case_id=:case AND membership_status='ACTIVE' AND valid_from<=now() AND (valid_to IS NULL OR valid_to>now())",group=body['groupId'],case=case_id):policy.deny('group_member')
            if body.get('projectId') and not one(c,"SELECT id FROM document_versions WHERE id=:id AND case_id=:case AND form_id IN ('F13','F14')",id=body['projectId'],case=case_id):policy.deny('project')
            if body.get('workshopId') and not one(c,'SELECT session_id FROM session_participants WHERE session_id=:id AND case_id=:case',id=body['workshopId'],case=case_id):policy.deny('workshop')
            goal_rows=rows(c,'SELECT id,payload FROM roadmap_objectives WHERE case_id=:id ORDER BY id',id=case_id)
            goals=[r['payload'] for r in goal_rows if r['payload'].get('confirmed') and r['payload'].get('confirmedBy') and r['payload'].get('confirmedAt') and r['id'] in body['goalIds']]
            administrative=template['payload']['recommendationStrategy'] in ('documents','deadlines','coordination')
            if set(body['goalIds'])-{g['id'] for g in goals}:return {'status':'abstained','recommendations':[],'limitations':['OBJECTIVES_UNCONFIRMED_OR_UNAVAILABLE']}
            if not goals and not administrative:return {'status':'abstained','recommendations':[],'limitations':['PROFESSIONAL_OBJECTIVES_REQUIRED']}
            age=one(c,'SELECT authz.child_age(:id) AS age',id=case_id)['age']
            if age is None:return {'status':'abstained','recommendations':[],'limitations':['PROTECTED_AGE_UNAVAILABLE']}
            candidates=[dict(r) for r in rows(c,'SELECT * FROM interventions ORDER BY id') if eligibility(r,goals,age,body['constraints'],template)]
            if body.get('activityId'):candidates=[r for r in candidates if r['id']==body['activityId']]
            skills={g['skill'] for g in goals}
            candidates.sort(key=lambda r:(-len(skills&set(r['payload']['skills'])),r['id']))
            candidates=candidates[:settings.max_candidates]
            if not candidates:return {'status':'abstained','recommendations':[],'limitations':['NO_ELIGIBLE_APPROVED_RESOURCES']}
            # No name, date of birth, social narrative or psychological note reaches the models.
            minimum={'context':template['payload']['labelAr' if language=='ar' else 'labelFr'],'validated_objectives':[g['description'][language] for g in goals],'available_materials':body['constraints']['materials'],'max_duration':body['constraints']['maxDuration'],'professional_request':body.get('request','')[:500],'professional_notes':body.get('additionalConstraints','')[:500]}
            context=json.dumps(ChildPrivacyService(c).project(minimum),ensure_ascii=False)[:3000]
            candidates=ChildPrivacyService(c).project(candidates)
            authz_hash=hashlib.sha256(json.dumps([e.employee_id,case_id,template_id,goals],sort_keys=True).encode()).hexdigest()
        limitations=['DEMO_CATALOGUE_NOT_MINISTRY_APPROVAL'];scores={};explanation=None
        if settings.ai_mode=='local':
            try:
                scores={s['id']:s['score'] for s in gateway.score(context,[{'id':r['id'],'text':plain({'title':r['payload']['title'],'description':r['payload']['description'],'skills':r['payload']['skills']})[:700]} for r in candidates])}
                if set(scores)!=set(r['id'] for r in candidates):raise LocalModelError('INVALID_CANDIDATES')
                limitations.append('SYSTEM_ONE_RESOURCE_SCORES_UNCALIBRATED')
                sources=[r['id'] for r in candidates]
                options=[{'source_id':r['id'],'text':r['payload']['description'][language][:220]} for r in candidates]
                explanation=gateway.generate('Select a grounded description of these pre-eligible educational resources. Do not prescribe or decide.',context,language,sources,options)
                if not explanation.get('source_ids') or set(explanation['source_ids'])-set(sources) or unsafe(explanation.get('answer','')):raise LocalModelError('INVALID_EXPLANATION')
                if not any(explanation['answer']==o['text'] and explanation['source_ids']==[o['source_id']] for o in options):raise LocalModelError('INVALID_EXPLANATION')
                limitations.append('LOCAL_EXTRACTIVE_SELECTION')
            except LocalModelError:return {'status':'model_unavailable','recommendations':[],'limitations':['LOCAL_MODELS_UNAVAILABLE_NO_CLOUD_FALLBACK']}
        else:limitations.append('DETERMINISTIC_DEMO_NO_MODEL_INFERENCE')
        proposals=[];run_id='REC-'+uuid.uuid4().hex
        with transaction(e.employee_id,Purpose.RECOMMENDATION) as c:
            policy=AuthorizationService(c,e)
            policy.require_active_session()
            template=next((t for t in available_templates(c,e,case_id) if t['id']==template_id),None)
            current_goals=[r['payload'] for r in rows(c,'SELECT id,payload FROM roadmap_objectives WHERE case_id=:id ORDER BY id',id=case_id) if r['id'] in body['goalIds']]
            if not template or current_goals!=goals:return {'status':'abstained','recommendations':[],'limitations':['ACCESS_OR_OBJECTIVES_CHANGED']}
            for candidate in candidates:
                fresh=one(c,'SELECT * FROM interventions WHERE id=:id',id=candidate['id'])
                if not fresh or not eligibility(fresh,goals,age,body['constraints'],template):return {'status':'abstained','recommendations':[],'limitations':['ELIGIBILITY_CHANGED']}
            versions={r['id']:{'revision':r['revision'],'status':r['status']} for r in rows(c,'SELECT id,revision,status FROM model_versions')} if settings.ai_mode=='local' else {}
            insert(c,'recommendation_runs',{'id':run_id,'employee_id':e.employee_id,'case_id':case_id,'template_id':template_id,'status':'completed','input_payload':body,'authz_fingerprint':authz_hash,'model_versions':{'mode':settings.ai_mode,'prompt_version':template['slm_prompt_version'],**versions},'limitations':limitations})
            for r in candidates:
                p=r['payload'];overlap=skills&set(p['skills']);deterministic=50+50*len(overlap)/max(1,len(skills));score=round(deterministic*.6+scores[r['id']]*.4,1) if scores else round(deterministic,1)
                proposal={'id':run_id+'-'+r['id'],'caseId':case_id,'activityId':r['id'] if r['kind']=='activity' else '','resourceId':r['id'] if r['kind']=='resource' else None,'kind':r['kind'],'goalIds':[g['id'] for g in goals if g['skill'] in p['skills']],'score':score,'reasons':[bi('المورد مرتبط بالأهداف المؤكدة ويستوفي شروط الأهلية.','La ressource correspond aux objectifs confirmés et respecte les critères d’éligibilité.')],'status':'suggested','date':now(),'contextId':template_id,'title':p['title'],'summary':p['description'],'sources':[{'id':r['id'],'kind':r['kind'],'label':p['source'],'path':'/library?activity='+r['id']}],'generatedFor':e.employee_id,'runId':run_id,'eligibility':'passed','modelExplanation':explanation['answer'] if explanation and r['id'] in explanation['source_ids'] else None}
                insert(c,'recommendation_candidates',{'id':proposal['id'],'run_id':run_id,'intervention_id':r['id'],'score':score,'payload':proposal});proposals.append(proposal)
            audit(c,e.employee_id,'recommendation.generate','recommendation_run',run_id,candidate_count=len(proposals),mode=settings.ai_mode)
        return {'status':'completed','run_id':run_id,'recommendations':sorted(proposals,key=lambda p:-p['score']),'limitations':limitations,'mode':settings.ai_mode}

    def feedback(self,c,e,candidate_id,status,reason):
        policy=AuthorizationService(c,e)
        row=one(c,'SELECT rc.*,r.case_id,r.template_id,r.input_payload FROM recommendation_candidates rc JOIN recommendation_runs r ON r.id=rc.run_id WHERE rc.id=:id',id=candidate_id)
        if not row:policy.deny('recommendation')
        selected=row['input_payload'].get('goalIds',[])
        current=[g['payload'] for g in rows(c,'SELECT id,payload FROM roadmap_objectives WHERE case_id=:id ORDER BY id',id=row['case_id']) if g['id'] in selected and g['payload'].get('confirmed')]
        expected=one(c,'SELECT authz_fingerprint FROM recommendation_runs WHERE id=:id',id=row['run_id'])['authz_fingerprint']
        fingerprint=hashlib.sha256(json.dumps([e.employee_id,row['case_id'],row['template_id'],current],sort_keys=True).encode()).hexdigest()
        if fingerprint!=expected:error('STALE_RECOMMENDATION',409)
        if not any(t['id']==row['template_id'] for t in available_templates(c,e,row['case_id'])):policy.deny('template')
        if not one(c,'SELECT id FROM interventions WHERE id=:id',id=row['intervention_id']):policy.deny('resource')
        insert(c,'recommendation_feedback',{'candidate_id':candidate_id,'employee_id':e.employee_id,'status':status,'reason':reason})
        audit(c,e.employee_id,'recommendation.feedback','recommendation_candidate',candidate_id,status=status)
        publish(c,e.employee_id,'RECOMMENDATION_FEEDBACK',candidate_id,status=status)
        return {'status':status,'official_plan_changed':False}

central_recommendation_engine=CentralRecommendationEngine()

def plan_intervention(c,e,case_id,body):
    policy=AuthorizationService(c,e);policy.require_case(case_id,'educational','write');policy.require_case(case_id,'roadmap','write')
    if not policy.capability('interventions.plan'):policy.deny('intervention')
    item=one(c,'SELECT * FROM interventions WHERE id=:id',id=body['intervention_id'])
    if not item:policy.deny('intervention')
    child=one(c,'SELECT ch.payload,ca.payload AS case FROM children ch JOIN cases ca ON ca.child_id=ch.id WHERE ca.id=:id',id=case_id)
    age=one(c,'SELECT authz.child_age(:id) AS age',id=case_id)['age']
    if age is None:error('PROTECTED_AGE_UNAVAILABLE')
    if child['case']['status']!='active' or item['kind']!='activity' or not(item['payload']['minAge']<=age<=item['payload']['maxAge']):error('INELIGIBLE_INTERVENTION')
    goals=rows(c,'SELECT id,payload FROM roadmap_objectives WHERE case_id=:id',id=case_id)
    matching=[g for g in goals if g['id'] in body['goal_ids'] and g['payload'].get('confirmed') and g['payload'].get('confirmedBy') and g['payload']['skill'] in item['payload']['skills']]
    if not matching or len(matching)!=len(set(body['goal_ids'])):error('CONFIRMED_OBJECTIVES_REQUIRED')
    if date.fromisoformat(body['date'])<date.today():error('INVALID_DATE')
    key='PLAN-'+body['idempotency_key']
    if one(c,'SELECT id FROM planned_interventions WHERE id=:id',id=key):return {'id':key,'created':False}
    roadmap=one(c,'SELECT id,version,payload FROM roadmaps WHERE case_id=:id FOR UPDATE',id=case_id)
    record(c,'planned_interventions',key,case_id,body,'educational',e.employee_id,roadmap_id=roadmap['id'])
    version=roadmap['version']+1
    c.execute(__import__('sqlalchemy').text('UPDATE roadmaps SET version=:v,author_id=:e WHERE id=:id'),{'v':version,'e':e.employee_id,'id':roadmap['id']})
    record(c,'roadmap_versions',uid('roadmap-version'),case_id,{'notes':roadmap['payload'].get('notes',''),'goals':[r['payload'] for r in goals],'plannedInterventionId':key},'roadmap',e.employee_id,status='APPROVED',version=version,roadmap_id=roadmap['id'])
    event(c,e,case_id,'activity',bi('تخطيط تدخل بقرار مهني مستقل','Intervention planifiée par décision professionnelle distincte'),body['reason'],key)
    publish(c,e.employee_id,'INTERVENTION_PLANNED',key);audit(c,e.employee_id,'intervention.plan','planned_intervention',key)
    return {'id':key,'created':True,'roadmap_version':version}
