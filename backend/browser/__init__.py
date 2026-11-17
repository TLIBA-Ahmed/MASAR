"""Read-only Browser: fixed SQL operations or bounded, source-validated RAG."""
import json,re,uuid
from datetime import datetime,timezone
from ..db import transaction,one,rows
from ..authorization import AuthorizationService,Purpose
from ..retrieval import AuthorizedRetrievalService,normalize
from ..ai_client import gateway,LocalModelError
from ..config import settings
from ..events import audit
from ..privacy import ChildPrivacyService
from ..model_gateway.prompts import GROUNDING_PROMPT_VERSION

def unsafe(text):
    value=normalize(text)
    return any(term in value for term in ['ignore previous','ignore instructions','system prompt','diagnostic automatique','dangerosite','delinquance','score de risque','cloturer automatiquement','تجاهل التعليمات','تشخيص نفسي','خطوره الطفل','قرار اغلاق'])
def response(language,status,answer='',sources=None,limitations=None,**extra):return {'request_id':'BR-'+uuid.uuid4().hex[:12],'status':status,'language':language,'answer':answer,'sources':sources or [],'limitations':limitations or [],'generated_at':datetime.now(timezone.utc).isoformat(),**extra}
def message(language,ar,fr):return ar if language=='ar' else fr

class IntelligentBrowserService:
    def ask(self,e,body):
        language=body['language'];question=body['question'];operation=body.get('operation')
        if unsafe(question):return response(language,'abstained',limitations=['UNSUPPORTED_OR_UNSAFE_REQUEST'])
        with transaction(e.employee_id,Purpose.BROWSER) as c:
            policy=AuthorizationService(c,e);retrieval=AuthorizedRetrievalService(c,e)
            if body.get('case_id'):policy.require_case(body['case_id'])
            if body.get('group_id'):policy.require_group(body['group_id'])
            question=ChildPrivacyService(c).text(question)
            if operation:
                if operation=='group_count':
                    policy.require_group(body.get('group_id',''))
                    n=one(c,"SELECT count(*) AS n FROM child_group_memberships m JOIN cases c ON c.id=m.case_id WHERE m.group_id=:id AND m.membership_status='ACTIVE' AND m.valid_from<=now() AND (m.valid_to IS NULL OR m.valid_to>now())",id=body['group_id'])['n']
                elif operation=='pending_objectives':n=one(c,"SELECT count(*) AS n FROM roadmap_objectives WHERE (CAST(:id AS text) IS NULL OR case_id=:id) AND coalesce((payload->>'confirmed')::boolean,false)=false",id=body.get('case_id'))['n']
                elif operation=='assessment_count':n=one(c,'SELECT count(*) AS n FROM initial_assessments WHERE (CAST(:id AS text) IS NULL OR case_id=:id)',id=body.get('case_id'))['n']
                elif operation=='intervention_count':n=one(c,'SELECT count(*) AS n FROM planned_interventions WHERE (CAST(:id AS text) IS NULL OR case_id=:id)',id=body.get('case_id'))['n']
                else:raise ValueError('UNKNOWN_CONTROLLED_OPERATION')
                audit(c,e.employee_id,'browser.structured','retrieval',operation)
                return response(language,'completed',message(language,f'العدد ضمن النطاق المسموح: {n}.',f'Nombre dans votre périmètre autorisé : {n}.'),sources=[{'source_id':operation,'document_id':body.get('group_id') or body.get('case_id') or 'authorized-scope','title':{'ar':'حساب علائقي مأذون','fr':'Calcul relationnel autorisé'},'page':None,'section':operation,'version':1,'path':'/assigned-children'}],mode='structured',value=n)
        vector=None
        if settings.ai_mode=='local':
            try:vector=gateway.embeddings([question],'query')[0]
            except LocalModelError:return response(language,'model_unavailable',limitations=['LOCAL_EMBEDDING_UNAVAILABLE'])
        with transaction(e.employee_id,Purpose.BROWSER) as c:
            retrieval=AuthorizedRetrievalService(c,e);evidence=retrieval.evidence(question,body.get('case_id'),vector)
            evidence=retrieval.reauthorize_evidence(evidence);sources=retrieval.sources(evidence)
        if not evidence:return response(language,'abstained',limitations=['NO_AUTHORIZED_RELIABLE_EVIDENCE'])
        if any(unsafe(r['chunk_text']) for r in evidence):return response(language,'abstained',limitations=['UNTRUSTED_REFERENCE_INSTRUCTION'])
        # Compact aliases keep long chunk hashes out of the small model's token budget.
        aliases={f'S{i+1}':r['id'] for i,r in enumerate(evidence)}
        context='\n'.join(f'[S{i+1}] '+r['chunk_text'][:500] for i,r in enumerate(evidence))[:settings.max_context_chars]
        options=[{'source_id':f'S{i+1}','text':r['chunk_text'][:220]} for i,r in enumerate(evidence)]
        with transaction(e.employee_id,Purpose.BROWSER) as c:
            for i,r in enumerate(evidence):
                if r['knowledge_id']:
                    source=one(c,'SELECT payload FROM knowledge_items WHERE id=:id',id=r['knowledge_id'])
                    if source:options[i]['text']=ChildPrivacyService(c).text(source['payload'].get('description',{}).get(language,r['chunk_text'][:220]))[:220]
        if settings.ai_mode=='demo':
            answer=message(language,'مقتطفات من المصادر التجريبية المسموح بها:\n','Extraits des sources de démonstration autorisées :\n')+'\n'.join(r['chunk_text'][:350] for r in evidence)
            limitation=['DETERMINISTIC_DEMO_NO_GENERATIVE_MODEL']
        else:
            try:
                output=gateway.generate(question,context,language,list(aliases),options)
                if not isinstance(output.get('answer'),str) or not output.get('source_ids') or set(output['source_ids'])-set(aliases) or unsafe(output['answer']):return response(language,'abstained',limitations=['OUTPUT_VALIDATION_FAILED'])
                if not any(output['answer']==o['text'] and output['source_ids']==[o['source_id']] for o in options):return response(language,'abstained',limitations=['OUTPUT_VALIDATION_FAILED'])
                cited={aliases[a] for a in output['source_ids']}
                answer=output['answer'];sources=[s for s in sources if s['source_id'] in cited];limitation=['LOCAL_EXTRACTIVE_SELECTION','SMALL_LOCAL_MODEL_REVIEW_SOURCES']
            except LocalModelError:return response(language,'model_unavailable',limitations=['LOCAL_SLM_UNAVAILABLE'])
        # Recheck after slow inference. Losing any reference discards the entire generated answer.
        with transaction(e.employee_id,Purpose.BROWSER) as c:
            retrieval=AuthorizedRetrievalService(c,e)
            retrieval.policy.require_active_session()
            if len(retrieval.reauthorize_evidence(evidence))!=len(evidence):return response(language,'abstained',limitations=['ACCESS_CHANGED'])
            audit(c,e.employee_id,'browser.answer','retrieval',source_count=len(sources),mode=settings.ai_mode,prompt_version=GROUNDING_PROMPT_VERSION if settings.ai_mode=='local' else None)
        return response(language,'completed',answer,sources,limitation,mode=settings.ai_mode)
