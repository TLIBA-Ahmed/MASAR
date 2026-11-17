import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { Badge,Panel,SectionHeading } from '../../components/ui';
export function RoadmapHistory({caseId}:{caseId:string}){
 const {data}=useWorkspace();const {l,b,date}=useLocale();
 const versions=data.backend?.roadmapHistory?.filter(r=>r.caseId===caseId)??[];
 const plans=data.backend?.plannedInterventions?.filter(r=>r.caseId===caseId)??[];
 if(!versions.length&&!plans.length)return null;
 return <Panel><SectionHeading title={l('تاريخ خطة التأهيل','Historique du plan de réhabilitation')} subtitle={l('إصدارات محفوظة وقرارات تخطيط بشرية مستقلة','Versions conservées et décisions humaines de planification distinctes')}/><div className="studio-form">{versions.map(v=><p key={v.id}><Badge tone="green">v{v.version}</Badge> {date(v.date)} · {b(data.professionals.find(p=>p.id===v.authorId)?.name??{ar:v.authorId,fr:v.authorId})}</p>)}{plans.map(p=><div className="proposal-reasons" key={p.id}><strong>{b(data.activities.find(a=>a.id===p.intervention_id)?.title??{ar:p.intervention_id,fr:p.intervention_id})}</strong><p>{date(p.date)}</p><p className="narrative">{p.reason}</p></div>)}</div></Panel>;
}
