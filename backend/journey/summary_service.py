"""Versioned derived summaries. Generation/review never changes the official journey."""
import uuid,json
from fastapi import HTTPException
from sqlalchemy import text
from ..db import transaction,one,rows
from ..authorization import AuthorizationService
from ..privacy import ChildPrivacyService
from ..seed import insert
from ..events import audit
from .summary_evidence import StageContextBuilder
from .summary_generator import StageSummaryGenerator


class JourneySummaryService:
    def require(self,c,e,case_id,operation):
        policy=AuthorizationService(c,e);policy.require_active_session();policy.require_case(case_id)
        code='journey.summary.'+operation
        if not policy.capability(code) or not one(c,'SELECT authz.has_scope(:case,:scope) AS ok',case=case_id,scope=code)['ok']:policy.deny('journey_summary')

    def serialize(self,c,row,context=None):
        value=dict(row)
        for key in ('generated_at','created_at','updated_at','validated_at'):
            if value.get(key):value[key]=value[key].isoformat()
        if context:value['outdated']=value['context_fingerprint']!=context['context_fingerprint']
        return ChildPrivacyService(c).project(value)

    def cards(self,c,e,case_id):
        builder=StageContextBuilder(c,e,case_id);result=[]
        for stage in range(1,6):
            context=builder.build(stage)
            history=rows(c,'SELECT * FROM journey_stage_summaries WHERE case_id=:case AND stage_id=:stage AND cycle_id=:cycle ORDER BY version DESC',case=case_id,stage=stage,cycle=context['cycle_id'])
            approved=next((r for r in history if r['validation_status']=='approved'),None)
            draft=next((r for r in history if r['validation_status']=='draft'),None)
            preview={**StageSummaryGenerator().generate_preview(context),'id':None,'version':0,'validation_status':'preview',**context}
            result.append(dict(stage_id=stage,cycle_id=context['cycle_id'],status=context['status'],period=context['period'],
                summary=self.serialize(c,approved,context) if approved else preview,
                latest_draft=self.serialize(c,draft,context) if draft else None,
                update_available=bool(approved and approved['context_fingerprint']!=context['context_fingerprint']),history_count=len(history)))
        p=builder.policy
        permissions={op:p.capability('journey.summary.'+op) and bool(one(c,'SELECT authz.has_scope(:case,:scope) AS ok',case=case_id,scope='journey.summary.'+op)['ok']) for op in ('generate','review')}
        return {'case_id':case_id,'child_code':builder.data['name']['fr'],'stages':result,'permissions':permissions}

    def generate(self,e,case_id,stage,cycle=None,manual=None):
        with transaction(e.employee_id,'journey.summary.generate') as c:
            self.require(c,e,case_id,'generate');context=StageContextBuilder(c,e,case_id).build(stage,cycle)
            if manual and (not context['started'] or not context['source_references']):raise HTTPException(422,detail={'code':'DOCUMENTED_STAGE_REQUIRED'})
            manual=ChildPrivacyService(c).project(manual) if manual else None
        # CPU work happens with no database transaction or row lock held.
        generated=StageSummaryGenerator().generate(context,manual)
        with transaction(e.employee_id,'journey.summary.generate') as c:
            self.require(c,e,case_id,'generate')
            fresh=StageContextBuilder(c,e,case_id).build(stage,context['cycle_id'])
            if fresh['context_fingerprint']!=context['context_fingerprint']:raise HTTPException(409,detail={'code':'SUMMARY_CONTEXT_CHANGED'})
            if not one(c,'SELECT authz.summary_sources_allowed(:case,CAST(:refs AS jsonb)) AS ok',case=case_id,refs=json.dumps(context['source_references']))['ok']:AuthorizationService(c,e).deny('journey_summary')
            version=one(c,'SELECT authz.next_summary_version(:case,:stage,:cycle) AS n',case=case_id,stage=stage,cycle=context['cycle_id'])['n']
            item=dict(id='JS-'+uuid.uuid4().hex,case_id=case_id,stage_id=stage,cycle_id=context['cycle_id'],version=version,
                sections=context['sections'],period=context['period'],source_references=context['source_references'],context_fingerprint=context['context_fingerprint'],created_by=e.employee_id,**generated)
            item=ChildPrivacyService(c).project(item)
            insert(c,'journey_stage_summaries',item,ignore_conflicts=False)
            audit(c,e.employee_id,'journey.summary.generate','journey_stage_summary',item['id'],stage=stage,cycle=context['cycle_id'],version=version,method=generated['generation_method'])
            return self.serialize(c,one(c,'SELECT * FROM journey_stage_summaries WHERE id=:id',id=item['id']),context)

    def history(self,c,e,case_id,stage,cycle=None):
        AuthorizationService(c,e).require_active_session();AuthorizationService(c,e).require_case(case_id)
        return {'versions':[self.serialize(c,r) for r in rows(c,'SELECT * FROM journey_stage_summaries WHERE case_id=:case AND stage_id=:stage AND (CAST(:cycle AS integer) IS NULL OR cycle_id=:cycle) ORDER BY cycle_id DESC,version DESC LIMIT 100',case=case_id,stage=stage,cycle=cycle)]}

    def review(self,c,e,case_id,summary_id,status,reason):
        self.require(c,e,case_id,'review')
        row=one(c,'SELECT * FROM journey_stage_summaries WHERE id=:id AND case_id=:case FOR UPDATE',id=summary_id,case=case_id)
        if not row:AuthorizationService(c,e).deny('journey_summary')
        if row['validation_status']!='draft':raise HTTPException(409,detail={'code':'IMMUTABLE_SUMMARY_HISTORY'})
        context=StageContextBuilder(c,e,case_id).build(row['stage_id'],row['cycle_id'])
        if status=='approved' and context['context_fingerprint']!=row['context_fingerprint']:raise HTTPException(409,detail={'code':'SUMMARY_CONTEXT_CHANGED'})
        c.execute(text('UPDATE journey_stage_summaries SET validation_status=:status,validated_by=:e,validated_at=now(),review_reason=:reason WHERE id=:id'),dict(status=status,e=e.employee_id,reason=ChildPrivacyService(c).text(reason),id=summary_id))
        audit(c,e.employee_id,'journey.summary.review','journey_stage_summary',summary_id,status=status,version=row['version'])
        return self.serialize(c,one(c,'SELECT * FROM journey_stage_summaries WHERE id=:id',id=summary_id),context)

    def evidence(self,c,e,case_id,summary_id,stage):
        AuthorizationService(c,e).require_active_session();AuthorizationService(c,e).require_case(case_id)
        if summary_id:
            row=one(c,'SELECT source_references,stage_id FROM journey_stage_summaries WHERE id=:id AND case_id=:case AND stage_id=:stage',id=summary_id,case=case_id,stage=stage)
            if not row:AuthorizationService(c,e).deny('journey_summary')
            refs=row['source_references']
        else:refs=StageContextBuilder(c,e,case_id).build(stage)['source_references']
        audit(c,e.employee_id,'journey.summary.evidence','case',case_id,stage=stage)
        return ChildPrivacyService(c).project({'sources':refs})

journey_summary_service=JourneySummaryService()
