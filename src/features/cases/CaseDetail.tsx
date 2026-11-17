import { PersonalInformation } from './PersonalInformation';
import { useJourneyResource } from '../child-journey/useJourneyResource';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileText,
  History,
  MapPin,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  User,
  Waypoints,
} from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import type { Case, Stage, SubStageStatus } from '../../types';
import { bi } from '../../types';
import { stages, skills } from '../../config/workflow';
import { forms } from '../../data/form-definitions';
import { decide, recordEvent } from '../../services/actions';
import { PlanPanel } from './PlanPanel';
import { RoadmapHistory } from './RoadmapHistory';
import { features } from '../../config/features';
import { requireCase } from '../../services/auth';
import { isoNow, uid } from '../../utils/date';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Field,
  Info,
  Modal,
  Panel,
  SectionHeading,
  useAction,
} from '../../components/ui';
import { Stepper } from '../../components/workflow/Stepper';
import { IntegrationPanel } from '../integration/Integration';
import { RecommendationLink } from '../../components/recommendations/RecommendationLink';
import { accessPolicyService } from '../../services/accessPolicy';
const tabs: [string, string, string][] = [
  ['overview', 'نظرة عامة', 'Vue générale'],
  ['identity', 'البيانات الشخصية', 'Informations personnelles'],
  ['family', 'الوضعية العائلية', 'Famille'],
  ['social', 'الوضعية الاجتماعية', 'Situation sociale'],
  ['interviews', 'المحادثات الفردية', 'Entretiens'],
  ['psychological', 'التقييم النفسي', 'Psychologie'],
  ['educational', 'التقييم التربوي', 'Éducation'],
  ['multidisciplinary', 'التقييم متعدد الاختصاصات', 'Évaluation pluridisciplinaire'],
  ['project', 'المشروع الفردي', 'Projet individualisé'],
  ['interventions', 'التدخلات والمتابعة', 'Interventions'],
  ['activities', 'الأنشطة والحضور', 'Activités et présences'],
  ['recommendations', 'التوصيات', 'Recommandations'],
  ['documents', 'الوثائق', 'Documents'],
  ['integration', 'الإدماج', 'Intégration'],
  ['history', 'سجل المتابعة', 'Historique'],
];
export function Timeline({ caseId, limit }: { caseId: string; limit?: number }) {
  const { data } = useWorkspace();
  const { b, l, date } = useLocale();
  const [params] = useSearchParams();
  const events = data.events
    .filter((e) => e.caseId === caseId)
    .toSorted((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  return (
    <div className="timeline">
      {events.length ? (
        events.map((e) => (
          <div
            id={`event-${e.id}`}
            className={`timeline-event ${e.type} ${params.get('event') === e.id ? 'target-resource' : ''}`}
            key={e.id}
          >
            <span className="timeline-dot">
              {e.type === 'activity' || e.type === 'recommendation' ? (
                <Sparkles size={12} />
              ) : e.type === 'decision' ? (
                <ShieldCheck size={12} />
              ) : (
                <FileText size={12} />
              )}
            </span>
            <div className="timeline-heading">
              <strong>{b(e.title)}</strong>
              <time>{date(e.date)}</time>
            </div>
            {e.note && <p className="narrative">{e.note}</p>}
            <small>
              {data.professionals.find((p) => p.id === e.professionalId)
                ? b(data.professionals.find((p) => p.id === e.professionalId)!.name)
                : l('الفريق', 'Équipe')}{' '}
              · {l('المرحلة', 'Étape')} {e.stage}
            </small>
          </div>
        ))
      ) : (
        <Empty title={l('السجل فارغ', 'Historique vide')} />
      )}
    </div>
  );
}
export function GoalPanel({ c }: { c: Case }) {
  const { l, b, t } = useLocale();
  const { mutate, data } = useWorkspace();
  const canWrite = data.backend
    ? Boolean(data.backend.access[c.id]?.categories.roadmap?.write)
    : true;
  const run = useAction();
  const [skill, setSkill] = useState('communication');
  const [notes, setNotes] = useState(c.projectNotes);
  return (
    <Panel className="goal-panel">
      <SectionHeading
        title={l('الأهداف التربوية الفردية', 'Objectifs éducatifs individualisés')}
        subtitle={l(
          'يؤكدها المهني قبل استعمالها في التوصيات',
          'Confirmés par un professionnel avant les recommandations',
        )}
      />
      <div className="goals-list">
        {c.goals.map((g) => (
          <label key={g.id} className={`goal-item ${g.confirmed ? 'confirmed' : ''}`}>
            <input
              type="checkbox"
              checked={g.confirmed}
              disabled={c.status !== 'active' || !canWrite}
              onChange={() =>
                run(() =>
                  mutate((d, s) => {
                    const target = requireCase(d, s, c.id);
                    const goal = target.goals.find((x) => x.id === g.id)!;
                    goal.confirmed = !goal.confirmed;
                    goal.confirmedBy = s.professionalId;
                    goal.confirmedAt = isoNow();
                    recordEvent(
                      d,
                      target,
                      s,
                      'goal',
                      bi('تحديث تأكيد هدف تربوي', 'Confirmation d’un objectif actualisée'),
                      goal.description.ar,
                    );
                  }),
                )
              }
            />
            <span>
              <strong>{b(g.description)}</strong>
              <small>
                {g.confirmed
                  ? l('هدف مؤكد مهنياً', 'Objectif confirmé')
                  : l('في انتظار التأكيد', 'À confirmer')}
              </small>
            </span>
            <Target size={15} />
          </label>
        ))}
      </div>
      {c.status === 'active' && canWrite && (
        <>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                mutate((d, s) => {
                  const target = requireCase(d, s, c.id);
                  if (target.goals.some((g) => g.skill === skill)) throw Error('VALIDATION');
                  target.goals.push({
                    id: uid('goal'),
                    skill,
                    description: skills[skill as keyof typeof skills],
                    confirmed: false,
                    dueDate: target.nextDue,
                  });
                  recordEvent(
                    d,
                    target,
                    s,
                    'goal',
                    bi('إضافة هدف تربوي للمراجعة', 'Objectif ajouté pour confirmation'),
                    skills[skill as keyof typeof skills].ar,
                  );
                }),
              );
            }}
          >
            <select
              aria-label={l('هدف تربوي جديد', 'Nouvel objectif')}
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
            >
              {Object.entries(skills).map(([key, value]) => (
                <option key={key} value={key}>
                  {b(value)}
                </option>
              ))}
            </select>
            <Button variant="secondary" type="submit">
              <Plus size={15} />
              {l('إضافة', 'Ajouter')}
            </Button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() =>
                mutate((d, s) => {
                  const target = requireCase(d, s, c.id);
                  target.projectNotes = notes;
                  recordEvent(
                    d,
                    target,
                    s,
                    'observation',
                    bi('تحديث المشروع الفردي', 'Projet individualisé actualisé'),
                    notes,
                  );
                }),
              );
            }}
          >
            <Field label={l('مساهمة في المشروع المشترك', 'Contribution au projet commun')}>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary">
              {t('save')}
            </Button>
          </form>
        </>
      )}
      <RecommendationLink
        className="button primary full-width"
        contexts={[
          'educational-project',
          'social-intervention',
          'professional-resources',
          'administrative-followup',
        ]}
        caseId={c.id}
      >
        <Sparkles size={16} />
        {l('اقتراح أنشطة ملائمة', 'Recommander des activités')}
      </RecommendationLink>
    </Panel>
  );
}
export function DecisionModal({
  c,
  open,
  onClose,
}: {
  c: Case;
  open: boolean;
  onClose: () => void;
}) {
  const { l, t, b } = useLocale();
  const { mutate, session } = useWorkspace();
  const run = useAction();
  const [kind, setKind] = useState<'advance' | 'extend' | 'close' | 'supervise' | 'archive'>(
      c.stage === 5 ? 'close' : 'advance',
    ),
    [reason, setReason] = useState('');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={l('قرار مهني بشأن المسار', 'Décision professionnelle sur le parcours')}
      description={l(
        'لا يحدث أي انتقال أو تمديد أو ختم تلقائياً. يُحفظ القرار مع سببه ومؤلفه.',
        'Toute transition, prolongation ou clôture est explicite et conservée avec son motif et son auteur.',
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = run(() => {
            mutate((d, s) => decide(d, s, c.id, kind, reason));
            return true;
          });
          if (result) {
            setReason('');
            onClose();
          }
        }}
      >
        <div className="dialog-body">
          <Field label={l('القرار', 'Décision')}>
            <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
              {c.stage < 5 && (
                <option value="advance">
                  {l('مواصلة نحو', 'Poursuivre vers')} {b(stages[Math.min(c.stage, 4)].title)}
                </option>
              )}
              {c.stage === 3 && (
                <option value="supervise">
                  {l('توثيق الإشراف الإداري', 'Confirmer la supervision administrative')}
                </option>
              )}
              {c.stage === 4 && (
                <option value="extend">
                  {l(
                    'تمديد — عودة للتأهيل مع دورة جديدة',
                    'Prolonger — nouveau cycle de réhabilitation',
                  )}
                </option>
              )}
              {c.stage === 5 && (
                <option value="close">
                  {l('ختم الملف بقرار مهني', 'Clôturer sur décision professionnelle')}
                </option>
              )}
              <option value="archive">{l('أرشفة تجريبية', 'Archivage simulé')}</option>
            </select>
          </Field>
          <Field
            required
            label={l('سبب القرار والمرجع المهني', 'Motif et référence de la décision')}
          >
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                kind === 'close'
                  ? l(
                      'نتائج الإدماج أو [N/A] مع التعليل',
                      'Résultats d’intégration ou [N/A] avec justification',
                    )
                  : ''
              }
            />
          </Field>
          {session?.role !== 'administration' &&
            ['extend', 'close', 'supervise'].includes(kind) && (
              <Info tone="orange">
                {l(
                  'هذا القرار مخصص لملف الإدارة التجريبي. يمكن تبديل الهوية من الفريق المهني.',
                  'Cette décision nécessite le profil Administration. Changez de profil depuis l’équipe professionnelle.',
                )}
              </Info>
            )}
          <Info>
            {l(
              'المراحل والمدد مقترحات تجريبية قابلة للتهيئة؛ ليست آجالاً قانونية عامة.',
              'Les étapes et durées sont configurables pour la démo ; elles ne constituent pas des délais légaux universels.',
            )}
          </Info>
        </div>
        <div className="dialog-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="submit">{l('توثيق القرار', 'Enregistrer la décision')}</Button>
        </div>
      </form>
    </Modal>
  );
}
export function CaseDetail() {
  const { caseId } = useParams();
  const { data, cases, mutate, session } = useWorkspace();
  const { l, b, t, date, lang } = useLocale();
  const c = cases.find((c) => c.id === caseId);
  const { data: folderAccess, error: folderError } = useJourneyResource<{ allowed: boolean }>(
    data.backend && caseId ? `/cases/${encodeURIComponent(caseId)}/access` : null,
  );
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const [stage, setStage] = useState<Stage>(c?.stage ?? 1),
    [decision, setDecision] = useState(false),
    [observation, setObservation] = useState('');
  const run = useAction();
  if (!c || folderError)
    return (
      <Empty
        title={l('الملف غير متاح في نطاقك', 'Dossier indisponible dans votre périmètre')}
        action={
          <Link className="button primary" to="/cases">
            {t('cases')}
          </Link>
        }
      />
    );
  if (data.backend && !folderAccess)
    return (
      <Panel>
        <p role="status">
          {l('التحقق من صلاحية فتح الملف…', 'Vérification de l’accès au dossier…')}
        </p>
      </Panel>
    );
  const ch = data.children.find((ch) => ch.id === c.childId)!;
  const professional = data.professionals.find((p) => p.id === c.referentId)!;
  const docs = data.submissions.filter((s) => s.caseId === c.id);
  const stageConfig = stages[stage - 1];
  const setTab = (tab: string) => setParams({ tab });
  const formMap: Record<string, string[]> = {
    interviews: ['F01'],
    psychological: ['F12'],
    educational: ['F02'],
    multidisciplinary: ['F08', 'F09'],
    social: ['F15'],
    documents: forms.map((f) => f.id),
    project: ['F13', 'F14'],
  };
  const formCards = (ids: string[]) => (
    <div className="case-documents">
      {forms
        .filter(
          (f) =>
            ids.includes(f.id) &&
            accessPolicyService.canRead(
              data,
              session,
              accessPolicyService.formResource(f.id, c.id, 'form'),
            ),
        )
        .map((f) => {
          const versions = docs
            .filter((s) => s.formId === f.id)
            .toSorted((a, b) => b.version - a.version);
          return (
            <div key={f.id} className="case-document">
              <span className="document-code">{f.id}</span>
              <div>
                <strong>{b(f.title)}</strong>
                <small>
                  {versions.length} {l('نسخ محفوظة', 'versions conservées')}
                </small>
              </div>
              <Badge tone={versions[0]?.status === 'validated' ? 'green' : 'neutral'}>
                {t(versions[0]?.status ?? 'notStarted')}
              </Badge>
              <Link className="button secondary" to={`/documents/${c.id}/${f.id}`}>
                {l('فتح', 'Ouvrir')}
              </Link>
            </div>
          );
        })}
    </div>
  );
  return (
    <>
      <div className="case-back">
        <Link to="/cases">
          {lang === 'ar' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />} {t('cases')}
        </Link>
        <span>/</span>
        <span dir="ltr">{c.id}</span>
        <Badge>{l('بيانات اصطناعية', 'Données synthétiques')}</Badge>
      </div>
      <Panel className="case-identity">
        <div className="case-person">
          <Avatar name={b(ch.name)} size="lg" color={1} />
          <div>
            <div className="case-name-line">
              <h1>{b(ch.name)}</h1>
              <Badge dot tone={c.status === 'active' ? 'green' : 'neutral'}>
                {t(c.status)}
              </Badge>
            </div>
            <p>
              <span dir="ltr">{c.id}</span>
              <i />
              {l('هوية محمية', 'Identité protégée')}
              <i />
              {l('فتح في', 'Ouvert le')} {date(c.openedAt)}
            </p>
          </div>
        </div>
        <div className="heading-actions">
          <Link className="button secondary" to={`/child-journey/${c.id}`}>
            <Waypoints size={16} />
            {t('childJourney')}
          </Link>
          <Button
            variant="secondary"
            onClick={() => setTab('identity')}
            disabled={
              c.status !== 'active' ||
              Boolean(data.backend && !data.backend.access[c.id]?.identity?.read)
            }
          >
            <Pencil size={15} />
            {l('تعديل البيانات', 'Modifier')}
          </Button>
          <Button
            onClick={() => setDecision(true)}
            disabled={c.status !== 'active' || !features.laterLifecycle}
          >
            <Waypoints size={16} />
            {l('قرار المسار', 'Décision du parcours')}
          </Button>
        </div>
        <div className="case-meta">
          <span>
            <MapPin size={15} />
            {b(data.centers.find((center) => center.id === c.centerId)!.name)}
          </span>
          <span>
            <User size={15} />
            {b(professional.name)}
          </span>
          <span>
            <CalendarDays size={15} />
            {l('الإجراء القادم', 'Échéance')} : {date(c.nextDue)}
          </span>
          <span>
            <History size={15} />
            {l('دورة التأهيل', 'Cycle de réhabilitation')} {c.cycle}
          </span>
        </div>
      </Panel>
      <Panel className="case-journey">
        <SectionHeading
          title={l('مسار التعهد', 'Parcours de prise en charge')}
          subtitle={l('خمس مراحل متصلة بملف رقمي واحد', 'Cinq étapes reliées à un dossier unique')}
          actions={<Badge tone="blue">{b(stages[c.stage - 1].short)}</Badge>}
        />
        <Stepper current={c.stage} selected={stage} onSelect={setStage} />
        <div className="substage-panel">
          <div>
            <h3>{b(stageConfig.title)}</h3>
            <p>{b(stageConfig.description)}</p>
            <span className="small muted">
              {l(
                'تقدم إداري فقط — لا يمثل تطور حالة الطفل',
                'Avancement administratif uniquement, sans mesure de l’état de l’enfant',
              )}
            </span>
          </div>
          <div className="substage-list">
            {stageConfig.subStages.map((s, i) => (
              <label key={`${stage}-${i}`}>
                <span>{b(s)}</span>
                <select
                  disabled={c.status !== 'active' || !features.laterLifecycle}
                  aria-label={b(s)}
                  value={c.subStages[`${stage}-${i}`] ?? 'notStarted'}
                  onChange={(e) =>
                    run(() =>
                      mutate((d, session) => {
                        const target = requireCase(d, session, c.id);
                        target.subStages[`${stage}-${i}`] = e.target.value as SubStageStatus;
                        recordEvent(
                          d,
                          target,
                          session,
                          'observation',
                          bi('تحديث متابعة مرحلة فرعية', 'Suivi d’une sous-étape actualisé'),
                          `${s.ar}: ${e.target.value}`,
                        );
                      }),
                    )
                  }
                >
                  {[
                    'notStarted',
                    'inProgress',
                    'completed',
                    'pending',
                    'validated',
                    'notApplicable',
                  ].map((status) => (
                    <option value={status} key={status}>
                      {t(status)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
        <div className="stage-doc-links">
          {forms
            .filter((f) => f.stages.includes(stage))
            .map((f) => (
              <Link key={f.id} to={`/documents/${c.id}/${f.id}`}>
                <FileText size={13} />
                {f.id}
              </Link>
            ))}
        </div>
      </Panel>
      <div className="case-tabs" role="tablist">
        {tabs.map(([key, a, f]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
            {l(a, f)}
          </button>
        ))}
      </div>
      {tab === 'overview' && (
        <div className="case-overview-grid">
          <div>
            <Panel>
              <SectionHeading
                title={l('الخطوة التالية تبدأ من هنا', 'La prochaine étape commence ici')}
                subtitle={l(
                  'توصيات تشغيلية مرتبطة بالملف',
                  'Actions opérationnelles liées au dossier',
                )}
              />
              <div className="next-action">
                <span className="soft-icon">
                  <Sparkles size={23} />
                </span>
                <div>
                  <h3>
                    {c.goals.some((g) => g.confirmed)
                      ? l('حوّل الأهداف إلى أنشطة عملية', 'Transformez les objectifs en activités')
                      : l('أكمل التقييم الأولي للمسار', 'Complétez l’évaluation initiale')}
                  </h3>
                  <p>
                    {c.goals.some((g) => g.confirmed)
                      ? l(
                          'راجع اقتراحات المكتبة وبرمج حصة بإشراف مهني.',
                          'Consultez les ressources et planifiez une séance accompagnée.',
                        )
                      : l(
                          'ابدأ بالمحادثة ثم وثّق تقييم الفريق.',
                          'Commencez par l’entretien et documentez l’évaluation de l’équipe.',
                        )}
                  </p>
                  {c.goals.some((g) => g.confirmed) ? (
                    <RecommendationLink
                      className="text-link"
                      contexts={[
                        'workshops',
                        'social-intervention',
                        'professional-resources',
                        'administrative-followup',
                        'educational-resources',
                      ]}
                      caseId={c.id}
                    >
                      {l('متابعة الإجراء', 'Poursuivre')}
                      <ArrowLeft className="direction-arrow" size={15} />
                    </RecommendationLink>
                  ) : (
                    <Link className="text-link" to={`/documents/${c.id}/F08`}>
                      {l('متابعة الإجراء', 'Poursuivre')}
                      <ArrowLeft className="direction-arrow" size={15} />
                    </Link>
                  )}
                </div>
              </div>
            </Panel>
            <Panel>
              <SectionHeading
                title={l('آخر مستجدات المسار', 'Dernières nouvelles du parcours')}
                actions={
                  <Button variant="ghost" onClick={() => setTab('history')}>
                    {t('history')}
                  </Button>
                }
              />
              <Timeline caseId={c.id} limit={5} />
            </Panel>
          </div>
          <div>
            {(!data.backend || data.backend.access[c.id]?.categories.roadmap?.read) && (
              <GoalPanel key={`${c.id}-${c.roadmapVersion}`} c={c} />
            )}
            <PlanPanel c={c} />
            <RoadmapHistory caseId={c.id} />
            <Panel className="team-card">
              <SectionHeading title={l('فريق المرافقة', 'Équipe d’accompagnement')} />
              {data.professionals
                .filter((p) =>
                  data.assignments.some((a) => a.caseId === c.id && a.professionalId === p.id),
                )
                .map((p, i) => (
                  <div className="team-person" key={p.id}>
                    <Avatar name={b(p.name)} color={i} />
                    <div>
                      <strong>{b(p.name)}</strong>
                      <small>{t(p.role)}</small>
                    </div>
                    <span className="live-dot" />
                  </div>
                ))}
              <Link to="/professionals" className="text-link">
                {l('فضاء التنسيق المهني', 'Espace de coordination')}
              </Link>
            </Panel>
          </div>
        </div>
      )}
      {tab === 'identity' && <PersonalInformation key={c.id} caseId={c.id} />}
      {tab === 'family' && (
        <Panel className="detail-info">
          <SectionHeading
            title={l('أسرة مرتبطة صراحة بالملف', 'Famille explicitement liée au dossier')}
          />
          <Info>
            {l(
              'لا يُستنتج أي رابط عائلي من الاسم أو العنوان. يؤكده المهني.',
              'Aucun lien familial n’est déduit du nom ou de l’adresse ; il est confirmé par un professionnel.',
            )}
          </Info>
          <dl className="details-grid">
            <div>
              <dt>{l('الأب', 'Père')}</dt>
              <dd>{ch.father || '—'}</dd>
            </div>
            <div>
              <dt>{l('الأم', 'Mère')}</dt>
              <dd>{ch.mother || '—'}</dd>
            </div>
          </dl>
          <h3>{l('ملفات مرتبطة بنفس الأسرة', 'Dossiers de la même famille')}</h3>
          {cases
            .filter(
              (target) =>
                target.id !== c.id &&
                data.children.find((child) => child.id === target.childId)?.familyId ===
                  ch.familyId,
            )
            .map((target) => (
              <Link key={target.id} className="family-case-link" to={`/cases/${target.id}`}>
                {target.id} — {b(data.children.find((child) => child.id === target.childId)!.name)}
              </Link>
            ))}
          {formCards(['F15'])}
        </Panel>
      )}
      {formMap[tab] && (
        <>
          <Panel className="detail-info">
            <SectionHeading
              title={l(tabs.find((x) => x[0] === tab)![1], tabs.find((x) => x[0] === tab)![2])}
              subtitle={l(
                'النسخ السابقة محفوظة ولا تُستبدل.',
                'Les versions précédentes sont conservées.',
              )}
            />
            {formCards(formMap[tab])}
          </Panel>
          {['psychological', 'multidisciplinary', 'educational'].includes(tab) && (
            <AssessmentComparison caseId={c.id} formIds={formMap[tab]} />
          )}
          {tab === 'project' && <GoalPanel key={c.id} c={c} />}
        </>
      )}
      {tab === 'history' && (
        <Panel className="detail-info">
          <SectionHeading
            title={t('history')}
            subtitle={l(
              'ملاحظات وتقييمات وأنشطة وقرارات محفوظة حسب التاريخ.',
              'Observations, évaluations, activités et décisions conservées chronologiquement.',
            )}
          />
          <Timeline caseId={c.id} />
        </Panel>
      )}
      {tab === 'interventions' && (
        <Panel className="detail-info">
          <SectionHeading title={t('interventions')} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const result = run(() => {
                mutate((d, s) => {
                  const target = requireCase(d, s, c.id);
                  if (target.status !== 'active') throw Error('INACTIVE');
                  recordEvent(
                    d,
                    target,
                    s,
                    'observation',
                    bi('تدخل وملاحظة مهنية', 'Intervention et observation professionnelle'),
                    observation,
                  );
                });
                return true;
              });
              if (result) setObservation('');
            }}
          >
            <Field
              required
              label={l('تدخل أو ملاحظة جديدة', 'Nouvelle intervention ou observation')}
            >
              <textarea
                required
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={c.status !== 'active'}>
              <Plus size={15} />
              {l('إضافة للسجل', 'Ajouter à l’historique')}
            </Button>
          </form>
          <Timeline caseId={c.id} />
        </Panel>
      )}
      {tab === 'activities' && (
        <Panel className="detail-info">
          <SectionHeading
            title={t('sessions')}
            actions={
              <RecommendationLink contexts={['workshops', 'support-activities']} caseId={c.id}>
                {l('برمجة نشاط', 'Programmer une activité')}
              </RecommendationLink>
            }
          />
          {data.sessions
            .filter((s) => s.participants.some((p) => p.caseId === c.id))
            .map((s) => (
              <Link className="session-row" key={s.id} to={`/sessions?session=${s.id}`}>
                <span>
                  <strong>{b(data.activities.find((a) => a.id === s.activityId)!.title)}</strong>
                  <small>
                    {date(s.date)} · {s.time}
                  </small>
                </span>
                <Badge tone={s.status === 'completed' ? 'green' : 'blue'}>{t(s.status)}</Badge>
                <span>{t(s.participants.find((p) => p.caseId === c.id)!.attendance)}</span>
              </Link>
            ))}
        </Panel>
      )}
      {tab === 'recommendations' && (
        <Panel className="detail-info">
          <SectionHeading title={t('recommendations')} />
          <Info>
            {l(
              'تُستخدم الأهداف التربوية التي يؤكدها المهني فقط، ولا تُستنتج احتياجات نفسية آلياً.',
              'Seuls les objectifs confirmés sont utilisés ; aucun besoin psychologique n’est déduit automatiquement.',
            )}
          </Info>
          <RecommendationLink
            contexts={[
              'educational-project',
              'social-intervention',
              'professional-resources',
              'administrative-followup',
            ]}
            caseId={c.id}
          >
            <Sparkles size={16} />
            {l('فتح محرك التوصيات', 'Ouvrir le moteur de recommandations')}
          </RecommendationLink>
          {data.recommendations
            .filter((r) => r.caseId === c.id)
            .map((r) => (
              <div className="session-row" key={r.id}>
                <strong>
                  {b(
                    r.title ??
                      data.activities.find((a) => a.id === r.activityId)?.title ??
                      bi(r.id, r.id),
                  )}
                </strong>
                <Badge>{t(r.status)}</Badge>
              </div>
            ))}
        </Panel>
      )}
      {tab === 'integration' && <IntegrationPanel caseId={c.id} />}
      <DecisionModal
        key={`${c.stage}-${c.cycle}`}
        c={c}
        open={decision}
        onClose={() => setDecision(false)}
      />
    </>
  );
}
function AssessmentComparison({ caseId, formIds }: { caseId: string; formIds: string[] }) {
  const { data } = useWorkspace();
  const { l, b, date, t } = useLocale();
  const versions = data.submissions
    .filter((s) => s.caseId === caseId && formIds.includes(s.formId) && s.status !== 'draft')
    .toSorted((a, b) => a.date.localeCompare(b.date));
  return (
    <Panel className="detail-info">
      <SectionHeading
        title={l('قراءة التقييمات المتتالية', 'Comparer les évaluations successives')}
        subtitle={l(
          'مقارنة نوعية دون تحويل الملاحظات إلى علامات.',
          'Comparaison qualitative, sans conversion en scores.',
        )}
      />
      <div className="assessment-comparison">
        {versions.map((v) => (
          <article key={v.id}>
            <Badge>
              {v.formId} · v{v.version}
            </Badge>
            <h3>{date(v.date)}</h3>
            {[
              'summary',
              'initialSynthesis',
              'strengths',
              'difficulties',
              'recommendations',
              'notes',
            ]
              .filter((key) => v.values[key])
              .map((key) => (
                <p className="narrative" key={key}>
                  {String(v.values[key])}
                </p>
              ))}
            <small>{b(data.professionals.find((p) => p.id === v.authorId)!.name)}</small>
            <Link to={`/documents/${caseId}/${v.formId}?version=${v.id}`} className="text-link">
              {t('open')}
            </Link>
          </article>
        ))}
      </div>
      {!versions.length && (
        <Empty title={l('لا توجد تقييمات محفوظة بعد', 'Aucune évaluation conservée')} />
      )}
    </Panel>
  );
}
