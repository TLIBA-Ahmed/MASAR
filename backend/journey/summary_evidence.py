"""Stage-specific, authorization-first evidence; never a second case database."""
import hashlib,json
from datetime import datetime,timezone
from ..db import one
from ..privacy import ChildPrivacyService
from . import _collect,_project

PROTECTED={'name','birthDate','birthplace','gender','address','phone','father','mother','school'}
SECTIONS=('situation','observations','actions','progress','objectives','next_actions','difficulties','decisions')

def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True,ensure_ascii=False,default=str).encode()).hexdigest()
def bi(ar,fr):return {'ar':ar,'fr':fr}
def instant(value):
    try:return datetime.fromisoformat(str(value).replace('Z','+00:00')).replace(tzinfo=timezone.utc).timestamp()
    except (ValueError,TypeError):return 0


class StageContextBuilder:
    def __init__(self,c,e,case_id):
        self.db=c;self.employee=e;self.case_id=case_id
        raw=_collect(c,e,case_id)
        self.policy=raw.pop('policy')
        projection=_project(c,e,case_id,{**raw,'policy':self.policy})
        privacy=ChildPrivacyService(c)
        self.data=privacy.project(raw);self.journey=privacy.project(projection)

    def build(self,stage_id,cycle_id=None):
        data=self.data;case=data['case'];current=int(case.get('cycle',1))
        cycle=1 if stage_id<3 else (cycle_id or current)
        if cycle<1 or cycle>current: self.policy.deny('journey_cycle')
        checkpoint=self.journey['checkpoints'][stage_id-1]
        sections={k:[] for k in SECTIONS};refs=[]
        extensions=sorted([r for r in data['records'] if r['table']=='case_status_history' and r['payload'].get('kind')=='extend'],key=lambda r:instant(r['payload'].get('date',r['created_at'])))
        def source_cycle(payload,when):
            if payload.get('kind')=='extend':return max(1,int(payload.get('cycle',2))-1)
            if payload.get('cycle'):return int(payload['cycle'])
            # Without access to cycle boundaries an unlabelled record cannot be assigned to a later cycle.
            return max([1]+[int(r['payload'].get('cycle',2)) for r in extensions if instant(when)>=instant(r['payload'].get('date',r['created_at']))])
        def add(kind,key,payload,title,when,parts,version=1):
            if not one(self.db,'SELECT authz.journey_source_allowed(:case,:kind,:key) AS ok',case=self.case_id,kind=kind,key=str(key))['ok']:return
            ref_id=kind+':'+str(key)
            clean=[]
            for section,value,label in parts:
                if isinstance(value,str) and value.strip():value=bi(value,value)
                if not isinstance(value,dict) or not value.get('ar') or not value.get('fr'):continue
                text={lang:((label[lang]+': ') if label else '')+str(value[lang])[:700] for lang in ('ar','fr')}
                sections[section].append({'text':text,'source_ids':[ref_id],'nature':'planned_action' if section=='next_actions' else 'professional_interpretation' if section in ('observations','progress','difficulties') else 'professional_decision' if section=='decisions' else 'documented_fact'})
                clean.append(text)
            if clean:
                refs.append(dict(id=str(key),kind=kind,reference_id=ref_id,title=title,date=str(when),version=version,
                                 excerpt={lang:'\n'.join(t[lang] for t in clean) for lang in ('ar','fr')},content_hash=digest(payload)))

        has_historical=cycle<current and stage_id in (3,4)
        if cycle<current and stage_id==5:
            has_historical=any(r['payload'].get('stage')==5 and r['payload'].get('type')=='integration' and source_cycle(r['payload'],r['payload'].get('date',r['created_at']))==cycle for r in data['records'])
        started=stage_id<=case['stage'] or has_historical
        if cycle<current and stage_id==5:started=has_historical
        if stage_id==1:
            add('case',self.case_id,case,checkpoint['title'],case['openedAt'],[
                ('situation',bi('ملف مركزي مفتوح للمتابعة','Dossier central ouvert pour l’accompagnement'),None),
                ('situation',case.get('source',''),bi('مصدر الإحالة المسجل','Orientation initiale enregistrée'))])
        for r in sorted(data['records'],key=lambda r:instant(r['payload'].get('date',r['created_at'])),reverse=True):
            p=r['payload'];n=p.get('stage',p.get('from',3))
            when=p.get('date',r['created_at'])
            if n!=stage_id or not started or (stage_id>=3 and source_cycle(p,when)!=cycle):continue
            section='decisions' if r['table']=='case_status_history' else 'observations'
            # A proposed recommendation remains an interpretation, never a commission decision.
            add(r['table'],r['id'],p,p.get('title',checkpoint['title']),when,[
                (section,p.get('note',p.get('reason','')),None),
                ('progress',p.get('result',''),bi('نتيجة مسجلة','Résultat documenté'))],r.get('version',1))
        for v in sorted(data['documents'],key=lambda v:(instant(v['payload'].get('date',v['created_at'])),v['version']),reverse=True):
            if v['status']=='draft':continue
            p=v['payload'];form=data['definitions'][v['form_id']]['payload'];when=p.get('date',v['created_at'])
            linked=next((r for r in data['records'] if r['payload'].get('sourceId')==v['id']),None)
            n=p.get('stage',linked['payload'].get('stage') if linked else form['stages'][0])
            if n!=stage_id or not started or (stage_id>=3 and source_cycle(p,when)!=cycle):continue
            parts=[]
            for field in [f for section in form['sections'] for f in section['fields']]:
                key=field['key'];value=p.get('values',{}).get(key)
                if field.get('shared') in PROTECTED or key in ('caseId','date','time','professional','referent','center'):continue
                if not isinstance(value,str) or not value.strip() or value in ('yes','no'):continue
                section='difficulties' if any(x in key.lower() for x in ('difficult','obstacle')) else 'progress' if any(x in key.lower() for x in ('progress','result','strength')) else 'objectives' if any(x in key.lower() for x in ('goal','objective','need')) else 'next_actions' if any(x in key.lower() for x in ('recommend','next')) else 'situation' if stage_id==1 else 'observations'
                parts.append((section,value,field.get('label')))
            add('document_versions',v['id'],p,v['title'],when,parts,v['version'])
        if stage_id==2 and started:
            for g in data['groups']:
                add('child_group_memberships',g['id'],g,g['name'],g['valid_from'],[
                    ('actions',g['name'],bi('مجموعة التكليف المسجلة','Groupe d’affectation enregistré'))])
        if stage_id==3 and started:
            versions=[v for v in data['versions'] if source_cycle(v['payload'],v['created_at'])==cycle]
            if versions:
                v=max(versions,key=lambda x:x['version'])
                add('roadmap_versions',v['id'],v['payload'],bi('المشروع الفردي','Projet individualisé'),v['created_at'],[
                    ('situation',v['payload'].get('notes',''),bi('خطة المرافقة','Plan d’accompagnement'))],v['version'])
            if cycle==current:
                for g in data['goals']:
                    add('roadmap_objectives',g['id'],g,bi('هدف فردي','Objectif individualisé'),g.get('dueDate',''),[
                        ('progress' if g.get('status')=='achieved' else 'objectives',g['description'],
                         bi('هدف موثق محقق','Objectif documenté atteint') if g.get('status')=='achieved' else bi('هدف قيد العمل','Objectif à travailler'))])
            for s in data['sessions']:
                p=s['payload'];when=p['date']
                if source_cycle(p,when)!=cycle:continue
                completed=p.get('status')=='completed'
                participation=s['participation']
                activity=one(self.db,'SELECT payload FROM interventions WHERE id=:id',id=p.get('activityId'))
                title=activity['payload']['title'] if activity else bi('نشاط','Activité')
                add('activity_sessions',s['id'],s,title,when,[
                    ('actions' if completed else 'next_actions',title,bi('نشاط مسجل منجز','Activité enregistrée réalisée') if completed else bi('نشاط مبرمج','Activité programmée')),
                    ('observations',participation.get('observations',participation.get('notes','')) if completed else '',None),
                    ('progress',participation.get('progress','') if completed else '',bi('تقدم سجله المهني','Progrès renseigné par le professionnel'))])
        if stage_id>=3 and cycle==current:
            for p in data['plans']:
                value=p['payload']
                if source_cycle(value,p['created_at'])!=cycle or stage_id!=3:continue
                add('planned_interventions',p['id'],value,bi('تدخل مبرمج','Intervention planifiée'),value.get('date',p['created_at']),[
                    ('next_actions',value.get('reason',''),bi('تدخل مبرمج، إنجازه غير مثبت','Intervention planifiée, réalisation non attestée'))])
        if started:
            for a in data['appointments']+data['tasks']:
                if a.get('completed') or stage_id!=case['stage'] or cycle!=current:continue
                kind='appointments' if a in data['appointments'] else 'tasks'
                add(kind,a['id'],a,a['title'],a.get('date',a.get('dueDate','')),[('next_actions',a['title'],bi('إجراء مقرر','Action prévue'))])
        # Keep evidence bounded and deterministic. Empty slots explicitly remain undocumented.
        evidence_revision=digest(sorted(refs,key=lambda r:r['reference_id']))
        for key in sections:sections[key]=sections[key][:4]
        used={sid for values in sections.values() for item in values for sid in item['source_ids']}
        refs=[r for r in refs if r['reference_id'] in used]
        context=dict(case_id=self.case_id,child_code=data['name']['fr'],stage_id=stage_id,cycle_id=cycle,
                     status=checkpoint['status'] if cycle==current or stage_id<3 else 'completed' if has_historical else 'future',started=started,
                     period={'start':checkpoint['startedAt'] if cycle==current or stage_id<3 else None,'end':checkpoint['endedAt'] if cycle==current or stage_id<3 else None},
                     sections=sections,source_references=refs,evidence_revision=evidence_revision)
        context['context_fingerprint']=digest(context)
        return context
