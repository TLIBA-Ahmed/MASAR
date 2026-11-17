import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CalendarPlus,
  Check,
  Clock3,
  FileStack,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsDown,
  Timer,
  Users,
  Waypoints,
} from 'lucide-react';
import type {
  ActivityTemplate,
  AppData,
  Recommendation,
  RecommendationConstraints,
  RecommendationContext,
  RecommendationInput,
  SessionContext,
} from '../../types';
import { centralRecommendationEngine } from '../../legacy/recommendations';
import { reviewRecommendation, scheduleRecommendation } from '../../services/actions';
import { accessPolicyService } from '../../services/accessPolicy';
import { skills, materialLabels } from '../../config/workflow';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ageAt } from '../../utils/date';
import { ActivityDetails } from '../activity-library/Library';
import {
  Avatar,
  Badge,
  Button,
  Empty,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  SectionHeading,
  useAction,
} from '../../components/ui';

function proposalIsCurrent(
  data: AppData,
  user: SessionContext | null,
  proposal: Recommendation | null,
) {
  if (!proposal || !user) return false;
  try {
    centralRecommendationEngine.validateProposal(data, user, proposal);
    return true;
  } catch {
    return false;
  }
}

export function ScheduleModal({
  rec,
  onClose,
  decision = 'accepted',
}: {
  rec: Recommendation | null;
  onClose: () => void;
  decision?: 'accepted' | 'adapted';
}) {
  const { l, b, t } = useLocale();
  const { data, cases, mutate, session } = useWorkspace();
  const run = useAction();
  const [date, setDate] = useState(data.demoDate),
    [time, setTime] = useState('10:00');
  const [participants, setParticipants] = useState<string[]>([]),
    [adaptations, setAdaptations] = useState('');
  const activity = data.activities.find((a) => a.id === rec?.activityId);
  const c = cases.find((c) => c.id === rec?.caseId);
  const requiredIds = rec?.targetCaseIds?.length ? rec.targetCaseIds : c ? [c.id] : [];
  const available = cases.filter(
    (x) =>
      !requiredIds.includes(x.id) &&
      x.status === 'active' &&
      x.stage >= 3 &&
      x.supervised &&
      ageAt(data.children.find((ch) => ch.id === x.childId)!.birthDate, data.demoDate) >=
        (activity?.minAge ?? 0) &&
      ageAt(data.children.find((ch) => ch.id === x.childId)!.birthDate, data.demoDate) <=
        (activity?.maxAge ?? 17) &&
      x.goals.some((g) => g.confirmed && activity?.skills.includes(g.skill)),
  );
  return (
    <Modal
      wide
      open={Boolean(rec && c && activity && proposalIsCurrent(data, session, rec))}
      onClose={onClose}
      title={
        decision === 'adapted'
          ? l('تكييف وبرمجة النشاط', 'Adapter et programmer l’activité')
          : l('قبول وبرمجة النشاط', 'Accepter et programmer l’activité')
      }
      description={activity ? `${b(activity.title)} · ${activity.id}` : ''}
    >
      {rec && activity && c && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const id = run(
              () =>
                mutate((d, user) =>
                  scheduleRecommendation(
                    d,
                    user,
                    rec,
                    date,
                    time,
                    participants,
                    adaptations,
                    decision,
                  ),
                ),
              l(
                'بُرمجت الحصة وأضيفت للمشروع والرزنامة والملف.',
                'La séance est ajoutée au projet, au calendrier et au dossier.',
              ),
            );
            if (id) onClose();
          }}
        >
          <div className="dialog-body">
            <Info tone="green">
              {l(
                'تؤكد هذه الخطوة مراجعتك البشرية لملاءمة النشاط. يبقى قرار التنفيذ بيد المهني.',
                'Cette étape confirme votre examen de la pertinence de l’activité. La décision reste professionnelle.',
              )}
            </Info>
            <div className="form-grid">
              <Field required label={l('تاريخ الحصة', 'Date de la séance')}>
                <input
                  type="date"
                  required
                  min={data.demoDate}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>
              <Field required label={l('التوقيت', 'Horaire')}>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </Field>
            </div>
            <div className="participant-heading">
              <h3>
                {l('المشاركون', 'Participants')} — {activity.minParticipants}–
                {activity.maxParticipants}
              </h3>
              <Badge>
                {requiredIds.length + participants.length} {l('مشاركاً', 'participants')}
              </Badge>
            </div>
            {requiredIds.map((id) => (
              <div className="selected-participant" key={id}>
                <Check size={15} />
                {id} ·{' '}
                {b(
                  data.children.find((ch) => ch.id === cases.find((c) => c.id === id)?.childId)!
                    .name,
                )}
                <small>{l('ضمن السياق المختار', 'Dans le contexte choisi')}</small>
              </div>
            ))}
            {activity.format === 'group' && (
              <div className="participant-picker">
                {available.map((p) => (
                  <label key={p.id}>
                    <input
                      type="checkbox"
                      checked={participants.includes(p.id)}
                      onChange={() =>
                        setParticipants((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                        )
                      }
                    />
                    <span>
                      {p.id} — {b(data.children.find((ch) => ch.id === p.childId)!.name)}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Field
              required
              label={l(
                'مبرر القبول والتكييف المهني',
                'Motif de validation et adaptations professionnelles',
              )}
            >
              <textarea
                required
                value={adaptations}
                onChange={(event) => setAdaptations(event.target.value)}
                placeholder={b(activity.adaptations)}
              />
            </Field>
            <Info tone="orange">
              {b(activity.conditions)}{' '}
              {l(
                'تحقق من العمر، الموافقة والمعدات قبل التنفيذ.',
                'Vérifiez l’âge, l’accord et le matériel avant la séance.',
              )}
            </Info>
          </div>
          <div className="dialog-footer">
            <Button variant="secondary" type="button" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button type="submit">
              <CalendarPlus size={16} />
              {l('تأكيد القبول والبرمجة', 'Confirmer et programmer')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

const initialConstraints: RecommendationConstraints = {
  maxDuration: 60,
  format: 'any',
  materials: Object.keys(materialLabels),
  participants: 3,
};
const contextIcon = (name: string) =>
  name === 'Users'
    ? Users
    : name === 'FileStack' || name === 'Files'
      ? FileStack
      : name === 'Waypoints'
        ? Waypoints
        : BookOpen;

export function Recommendations() {
  const { data, session } = useWorkspace();
  const contexts = centralRecommendationEngine.availableContexts(data, session);
  const [params] = useSearchParams();
  const requested = params.get('context');
  const selected = contexts.find((c) => c.contextId === requested);
  const key = `${accessPolicyService.contextKey(data, session)}|${selected?.contextId ?? 'none'}|${contexts.map((c) => c.contextId).join(',')}|${params.get('case') ?? ''}|${params.get('activity') ?? ''}|${params.get('workshop') ?? ''}`;
  return <RecommendationWorkspace key={key} contexts={contexts} context={selected} />;
}

function RecommendationWorkspace({
  contexts,
  context,
}: {
  contexts: RecommendationContext[];
  context?: RecommendationContext;
}) {
  const { l, b, t } = useLocale();
  const { data, cases, session, mutate } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const run = useAction();
  const [caseId, setCaseId] = useState(
    params.get('case') ??
      (cases.some((c) => c.id === 'CDIS-024')
        ? 'CDIS-024'
        : (cases.find((c) => c.status === 'active')?.id ?? '')),
  );
  const [targetMode, setTargetMode] = useState(params.get('workshop') ? 'workshop' : 'child');
  const [projectId, setProjectId] = useState(''),
    [groupId, setGroupId] = useState(''),
    [workshopId, setWorkshopId] = useState(params.get('workshop') ?? '');
  const [selectedGoals, setSelectedGoals] = useState<string[] | null>(null),
    [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [constraints, setConstraints] = useState(initialConstraints),
    [request, setRequest] = useState(''),
    [additionalConstraints, setAdditionalConstraints] = useState('');
  const [generated, setGenerated] = useState(''),
    [detail, setDetail] = useState<ActivityTemplate | null>(null);
  const [schedule, setSchedule] = useState<{
    rec: Recommendation;
    decision: 'accepted' | 'adapted';
  } | null>(null);
  const [review, setReview] = useState<{
      rec: Recommendation;
      decision: 'accepted' | 'adapted' | 'rejected' | 'deferred';
    } | null>(null),
    [reason, setReason] = useState('');
  const fields = [...(context?.requiredInputs ?? []), ...(context?.optionalInputs ?? [])];
  const hasCollectiveTarget = fields.includes('groupId') || fields.includes('workshopId');
  const workshops = data.sessions.filter(
    (s) =>
      ['planned', 'inProgress'].includes(s.status) &&
      s.participants.every((p) => cases.some((c) => c.id === p.caseId && c.status === 'active')),
  );
  const groups = [...new Set(workshops.map((s) => s.group).filter(Boolean))];
  const targetIds =
    hasCollectiveTarget && targetMode !== 'child'
      ? [
          ...new Set(
            workshops
              .filter((s) =>
                targetMode === 'workshop' ? s.id === workshopId : s.group === groupId,
              )
              .flatMap((s) => s.participants.map((p) => p.caseId)),
          ),
        ]
      : caseId
        ? [caseId]
        : [];
  const targets = cases.filter((c) => targetIds.includes(c.id));
  const c = cases.find((c) => c.id === caseId);
  const goals = targets.flatMap((c) =>
    c.goals
      .filter((g) => g.confirmed && g.confirmedBy && g.confirmedAt)
      .map((g) => ({ ...g, caseId: c.id })),
  );
  const activeGoals = selectedGoals ?? goals.map((g) => g.id);
  const projectForm = context?.recommendationStrategy === 'training' ? 'F14' : 'F13';
  const projectVersions = data.submissions
    .filter((s) => s.caseId === caseId && s.formId === projectForm)
    .toSorted((a, b) => b.version - a.version);
  const input: RecommendationInput = {
    ...(!hasCollectiveTarget || targetMode === 'child'
      ? { caseId: caseId || undefined }
      : targetMode === 'group'
        ? { groupId }
        : { workshopId }),
    ...(fields.includes('goalIds') ? { goalIds: activeGoals } : {}),
    ...(fields.includes('projectId') && projectId ? { projectId } : {}),
    ...(fields.includes('skills') ? { skills: selectedSkills } : {}),
    ...(fields.includes('maxDuration') ? { constraints } : {}),
    ...(fields.includes('request') ? { request } : {}),
    ...(fields.includes('constraints') ? { additionalConstraints } : {}),
    ...(params.get('activity') && fields.includes('maxDuration')
      ? { activityId: params.get('activity')! }
      : {}),
  };
  const inputKey = JSON.stringify([context?.contextId, input]);
  let recommendations: Recommendation[] = [];
  let stale = false;
  if (generated === inputKey && context && session) {
    try {
      recommendations = centralRecommendationEngine.generate(
        data,
        session,
        context.contextId,
        input,
      );
    } catch {
      stale = true;
    }
  }
  const resetTarget = () => {
    setSelectedGoals(null);
    setSelectedSkills([]);
    setProjectId('');
    setGenerated('');
  };
  const openReview = (
    rec: Recommendation,
    decision: 'accepted' | 'adapted' | 'rejected' | 'deferred',
  ) => {
    if (rec.kind === 'activity' && (decision === 'accepted' || decision === 'adapted'))
      setSchedule({ rec, decision });
    else {
      setReason('');
      setReview({ rec, decision });
    }
  };
  return (
    <>
      <PageHeading
        eyebrow={l(
          'المكوّن الذكي 02 / دعم القرار المهني',
          'MODULE INTELLIGENT 02 / AIDE AU PROFESSIONNEL',
        )}
        title={t('recommendations')}
        description={l(
          'محرك مركزي واحد، يتكيّف مع دورك وصلاحياتك وسياق عملك.',
          'Un moteur central qui s’adapte à votre métier, vos droits et votre contexte de travail.',
        )}
        actions={
          <Link className="button secondary" to="/library">
            {t('library')}
          </Link>
        }
      />
      <Info>
        <ShieldCheck size={15} />
        {l(
          'اقتراحات استشارية محلية مبنية على أهداف مهنية مؤكدة. لا تشخيص ولا تصنيف اجتماعي أو قضائي ولا قرار توجيه أو ختم آلي.',
          'Suggestions locales et consultatives fondées sur des objectifs professionnels confirmés. Aucun diagnostic, classement social ou judiciaire, ni décision automatique d’orientation ou de clôture.',
        )}
      </Info>
      <Panel className="recommendation-context-selector">
        <SectionHeading
          title={l('في أي مجال تريد دعماً؟', 'Dans quel domaine souhaitez-vous un appui ?')}
          subtitle={l(
            'اختر سياقاً متاحاً وفق دورك وتكليفك وصلاحياتك.',
            'Choisissez un contexte disponible selon votre rôle, vos attributs et vos permissions.',
          )}
        />
        <div className="context-choice-grid">
          {contexts.map((item) => {
            const Icon = contextIcon(item.icon);
            return (
              <button
                key={item.contextId}
                className={`context-choice ${item.contextId === context?.contextId ? 'selected' : ''}`}
                aria-pressed={item.contextId === context?.contextId}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('context', item.contextId);
                  next.delete('activity');
                  next.delete('workshop');
                  setParams(next);
                }}
              >
                <Icon size={20} />
                <span>{l(item.labelAr, item.labelFr)}</span>
                {item.contextId === context?.contextId && <Check size={15} />}
              </button>
            );
          })}
        </div>
      </Panel>
      {context ? (
        <div className="recommendation-layout">
          <aside>
            <Panel className="recommendation-context">
              <SectionHeading
                title={l(context.labelAr, context.labelFr)}
                subtitle={b(context.description)}
              />
              <div className="context-body">
                {hasCollectiveTarget && (
                  <Field label={l('نطاق النشاط', 'Cible de l’activité')}>
                    <select
                      value={targetMode}
                      onChange={(event) => {
                        setTargetMode(event.target.value);
                        resetTarget();
                      }}
                    >
                      <option value="child">{l('طفل', 'Enfant')}</option>
                      {fields.includes('groupId') && <option value="group">{t('group')}</option>}
                      {fields.includes('workshopId') && (
                        <option value="workshop">{l('ورشة', 'Atelier')}</option>
                      )}
                    </select>
                  </Field>
                )}
                {(!hasCollectiveTarget || targetMode === 'child') && (
                  <Field
                    required={context.requiredInputs.includes('caseId')}
                    label={l('الملف الرقمي المركزي', 'Dossier central')}
                  >
                    <select
                      value={caseId}
                      onChange={(event) => {
                        setCaseId(event.target.value);
                        resetTarget();
                      }}
                    >
                      <option value="">
                        {context.requiredInputs.includes('caseId') || hasCollectiveTarget
                          ? l('اختر ملفاً', 'Choisir un dossier')
                          : l('جميع الملفات المصرح بها', 'Tous les dossiers autorisés')}
                      </option>
                      {cases
                        .filter((c) => c.status === 'active')
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
                          </option>
                        ))}
                    </select>
                  </Field>
                )}
                {hasCollectiveTarget && targetMode === 'group' && (
                  <Field required label={l('المجموعة', 'Groupe')}>
                    <select
                      value={groupId}
                      onChange={(event) => {
                        setGroupId(event.target.value);
                        resetTarget();
                      }}
                    >
                      <option value="">{l('اختر مجموعة', 'Choisir un groupe')}</option>
                      {groups.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {hasCollectiveTarget && targetMode === 'workshop' && (
                  <Field required label={l('الورشة', 'Atelier')}>
                    <select
                      value={workshopId}
                      onChange={(event) => {
                        setWorkshopId(event.target.value);
                        resetTarget();
                      }}
                    >
                      <option value="">{l('اختر ورشة', 'Choisir un atelier')}</option>
                      {workshops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.group || s.id} · {s.date}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {c && (targetMode === 'child' || !hasCollectiveTarget) && (
                  <div className="recommendation-child">
                    <Avatar
                      name={b(data.children.find((ch) => ch.id === c.childId)!.name)}
                      color={1}
                    />
                    <div>
                      <strong>{b(data.children.find((ch) => ch.id === c.childId)!.name)}</strong>
                      <small>
                        {c.id} ·{' '}
                        {ageAt(
                          data.children.find((ch) => ch.id === c.childId)!.birthDate,
                          data.demoDate,
                        )}{' '}
                        {l('سنة', 'ans')}
                      </small>
                    </div>
                  </div>
                )}
                {fields.includes('projectId') && (
                  <Field label={l('المشروع الموجود', 'Projet existant')}>
                    <select
                      value={projectId}
                      onChange={(event) => setProjectId(event.target.value)}
                    >
                      <option value="">
                        {l('الأهداف المركزية الحالية', 'Objectifs centraux actuels')}
                      </option>
                      {projectVersions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.formId} · v{s.version} · {t(s.status)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {fields.includes('goalIds') && (
                  <fieldset className="goal-picker">
                    <legend>
                      {l('الأهداف التي أكدها المهني', 'Objectifs confirmés par un professionnel')}
                    </legend>
                    {goals.length ? (
                      goals.map((goal) => (
                        <label key={goal.id}>
                          <input
                            type="checkbox"
                            checked={activeGoals.includes(goal.id)}
                            onChange={() =>
                              setSelectedGoals(
                                activeGoals.includes(goal.id)
                                  ? activeGoals.filter((id) => id !== goal.id)
                                  : [...activeGoals, goal.id],
                              )
                            }
                          />
                          <span>
                            {b(goal.description)}
                            {targets.length > 1 && <small>{goal.caseId}</small>}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p>
                        {l(
                          'لا توجد أهداف مؤكدة في هذا النطاق.',
                          'Aucun objectif confirmé dans ce périmètre.',
                        )}
                      </p>
                    )}
                  </fieldset>
                )}
                {c && (
                  <Link to={`/cases/${c.id}?tab=project`} className="text-link">
                    {l('مراجعة الأهداف والسياق', 'Revoir les objectifs et le contexte')}
                  </Link>
                )}
                {fields.includes('projectId') &&
                  context.authorizedDataSources.includes('workshop') && (
                    <div className="context-summary">
                      <h4>{l('أنشطة سابقة في المشروع', 'Activités précédemment réalisées')}</h4>
                      {data.sessions
                        .filter(
                          (s) =>
                            s.status === 'completed' &&
                            s.participants.some((p) => targetIds.includes(p.caseId)),
                        )
                        .map((s) => (
                          <Link key={s.id} to={`/sessions?session=${s.id}`}>
                            {b(data.activities.find((a) => a.id === s.activityId)!.title)} ·{' '}
                            {s.date}
                          </Link>
                        ))}
                    </div>
                  )}
              </div>
            </Panel>
            <Panel className="recommendation-constraints">
              <SectionHeading
                title={l('معطيات السياق', 'Paramètres du contexte')}
                actions={<SlidersHorizontal size={16} />}
              />
              <div className="context-body">
                {fields.includes('skills') && (
                  <Field label={l('المهارة ذات الأولوية', 'Compétence à privilégier')}>
                    <select
                      value={selectedSkills[0] ?? ''}
                      onChange={(event) =>
                        setSelectedSkills(event.target.value ? [event.target.value] : [])
                      }
                    >
                      <option value="">
                        {l(
                          'كل المهارات المرتبطة بالأهداف',
                          'Toutes les compétences liées aux objectifs',
                        )}
                      </option>
                      {Object.entries(skills).map(([key, label]) => (
                        <option key={key} value={key}>
                          {b(label)}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                {fields.includes('maxDuration') && (
                  <Field label={l('المدة القصوى بالدقائق', 'Durée maximale (min)')}>
                    <input
                      type="number"
                      min={10}
                      max={180}
                      value={constraints.maxDuration}
                      onChange={(event) =>
                        setConstraints((p) => ({ ...p, maxDuration: Number(event.target.value) }))
                      }
                    />
                  </Field>
                )}
                {fields.includes('format') && (
                  <Field label={l('صيغة النشاط', 'Format')}>
                    <select
                      value={constraints.format}
                      onChange={(event) =>
                        setConstraints((p) => ({
                          ...p,
                          format: event.target.value as RecommendationConstraints['format'],
                        }))
                      }
                    >
                      <option value="any">{l('فردي وجماعي', 'Individuel et collectif')}</option>
                      <option value="individual">{t('individual')}</option>
                      <option value="group">{t('group')}</option>
                    </select>
                  </Field>
                )}
                {fields.includes('participants') &&
                  constraints.format !== 'individual' &&
                  targetMode === 'child' && (
                    <Field label={l('حجم المجموعة المقترح', 'Effectif du groupe envisagé')}>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={constraints.participants}
                        onChange={(event) =>
                          setConstraints((p) => ({
                            ...p,
                            participants: Number(event.target.value),
                          }))
                        }
                      />
                    </Field>
                  )}
                {fields.includes('materials') && (
                  <fieldset className="goal-picker">
                    <legend>{l('المعدات المتاحة', 'Matériel disponible')}</legend>
                    <div className="material-checkboxes">
                      {Object.entries(materialLabels).map(([key, label]) => (
                        <label key={key}>
                          <input
                            type="checkbox"
                            checked={constraints.materials.includes(key)}
                            onChange={() =>
                              setConstraints((p) => ({
                                ...p,
                                materials: p.materials.includes(key)
                                  ? p.materials.filter((m) => m !== key)
                                  : [...p.materials, key],
                              }))
                            }
                          />
                          {b(label)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                {fields.includes('constraints') && (
                  <Field
                    label={l('قيود إضافية (اختياري)', 'Contraintes complémentaires (facultatif)')}
                  >
                    <textarea
                      dir="auto"
                      value={additionalConstraints}
                      onChange={(event) => setAdditionalConstraints(event.target.value)}
                      placeholder={l(
                        'ملاحظات ليراجعها المهني…',
                        'Éléments à examiner par le professionnel…',
                      )}
                    />
                  </Field>
                )}
                {fields.includes('request') && (
                  <Field label={l('طلب مكمل (اختياري)', 'Demande complémentaire (facultatif)')}>
                    <textarea
                      dir="auto"
                      value={request}
                      onChange={(event) => setRequest(event.target.value)}
                    />
                  </Field>
                )}
                <Button
                  className="full-width"
                  onClick={() => {
                    const result = run(
                      () =>
                        centralRecommendationEngine.generate(
                          data,
                          session!,
                          context.contextId,
                          input,
                        ),
                      l(
                        'أُعدّت الاقتراحات للمراجعة المهنية.',
                        'Propositions préparées pour la revue professionnelle.',
                      ),
                    );
                    if (result) setGenerated(inputKey);
                  }}
                >
                  <Sparkles size={16} />
                  {l('إعداد التوصيات', 'Générer les recommandations')}
                </Button>
              </div>
            </Panel>
          </aside>
          <div>
            <div className="recommendation-results-heading">
              <div>
                <span className="eyebrow">{l(context.labelAr, context.labelFr)}</span>
                <h2>
                  {l('اقتراحات لمراجعتك المهنية', 'Propositions pour votre revue professionnelle')}
                </h2>
              </div>
              <Badge tone="green">
                {recommendations.length} {l('اقتراحات', 'propositions')}
              </Badge>
            </div>
            {recommendations.length ? (
              recommendations.slice(0, 20).map((rec, index) => {
                const activity = data.activities.find((a) => a.id === rec.activityId);
                const feedback = data.recommendations.find((r) => r.id === rec.id);
                return (
                  <Panel className="recommendation-card" key={rec.id}>
                    <div className="rec-card-top">
                      <span className="rec-rank">{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <h2>{rec.title ? b(rec.title) : activity && b(activity.title)}</h2>
                        <span>{l(context.labelAr, context.labelFr)}</span>
                      </div>
                      <Badge tone={feedback?.status === 'accepted' ? 'green' : 'blue'}>
                        {feedback
                          ? t(feedback.status)
                          : rec.goalIds.length
                            ? `${rec.score}% ${l('مطابقة أهداف', 'des objectifs')}`
                            : l('للمراجعة', 'À examiner')}
                      </Badge>
                    </div>
                    {rec.summary && <p>{b(rec.summary)}</p>}
                    <div className="rec-reasons">
                      <h3>{l('لماذا هذا الاقتراح؟', 'Pourquoi cette proposition ?')}</h3>
                      {rec.reasons.map((item, i) => (
                        <p key={i}>
                          <Check size={13} />
                          {b(item)}
                        </p>
                      ))}
                    </div>
                    {activity && (
                      <div className="rec-meta">
                        <span>
                          <Clock3 size={14} />
                          {activity.duration} {t('minute')}
                        </span>
                        <span>
                          <Users size={14} />
                          {t(activity.format)}
                        </span>
                        <span>
                          {activity.materials.map((m) => b(materialLabels[m])).join('، ')}
                        </span>
                      </div>
                    )}
                    {Boolean(rec.program?.length) && (
                      <details className="rec-explanation">
                        <summary>
                          {l('خطة البرنامج المقترح للمراجعة', 'Trame proposée à examiner')}
                        </summary>
                        <ol>
                          {rec.program?.map((step, i) => (
                            <li key={i}>{b(step)}</li>
                          ))}
                        </ol>
                      </details>
                    )}
                    <details className="rec-explanation">
                      <summary>
                        {l('الأهداف والمصادر', 'Objectifs et sources')} · {rec.sources?.length ?? 0}
                      </summary>
                      <div className="recommendation-sources">
                        {rec.sources?.map((source) => (
                          <Link key={`${source.kind}-${source.id}`} to={source.path}>
                            <BookOpen size={14} />
                            {b(source.label)}
                          </Link>
                        ))}
                      </div>
                    </details>
                    {feedback?.feedback && (
                      <p className="narrative review-reason">{feedback.feedback}</p>
                    )}
                    <div className="rec-actions">
                      {activity && (
                        <Button variant="secondary" onClick={() => setDetail(activity)}>
                          {l('عرض التفاصيل', 'Voir le détail')}
                        </Button>
                      )}
                      {feedback?.status === 'accepted' ? (
                        feedback.sessionId ? (
                          <Link
                            className="button primary"
                            to={`/sessions?session=${feedback.sessionId}`}
                          >
                            {l('متابعة الحصة', 'Suivre la séance')}
                          </Link>
                        ) : (
                          <Badge tone="green">
                            {l('أُضيف للملف بعد مراجعتك', 'Ajoutée au dossier après votre revue')}
                          </Badge>
                        )
                      ) : (
                        <>
                          <Button onClick={() => openReview(rec, 'accepted')}>
                            <Check size={15} />
                            {activity
                              ? l('قبول وبرمجة', 'Accepter et programmer')
                              : l('قبول', 'Accepter')}
                          </Button>
                          <Button variant="ghost" onClick={() => openReview(rec, 'adapted')}>
                            {l('تكييف', 'Adapter')}
                          </Button>
                          <Button variant="ghost" onClick={() => openReview(rec, 'deferred')}>
                            <Timer size={14} />
                            {l('تأجيل', 'Reporter')}
                          </Button>
                          <Button variant="ghost" onClick={() => openReview(rec, 'rejected')}>
                            <ThumbsDown size={13} />
                            {l('رفض', 'Refuser')}
                          </Button>
                        </>
                      )}
                    </div>
                  </Panel>
                );
              })
            ) : (
              <Panel>
                <Empty
                  title={
                    stale
                      ? l(
                          'تغيرت المعطيات؛ أعد التوليد',
                          'Les données ont changé ; régénérez les propositions',
                        )
                      : generated === inputKey
                        ? l(
                            'لا توجد اقتراحات مطابقة لهذه المعطيات',
                            'Aucune proposition compatible avec ces paramètres',
                          )
                        : l(
                            'اختر الأهداف وأعدّ التوصيات',
                            'Choisissez les objectifs et générez les recommandations',
                          )
                  }
                  description={l(
                    'راجع الأهداف المؤكدة والمصادر والمعدات المتاحة. أي تدخل يخضع لتقدير المهني.',
                    'Examinez les objectifs confirmés, les sources et les moyens disponibles. Toute intervention reste soumise au jugement professionnel.',
                  )}
                />
              </Panel>
            )}
          </div>
        </div>
      ) : (
        <Panel>
          <Empty
            title={l('اختر سياقاً مصرحاً به', 'Sélectionnez un contexte autorisé')}
            description={
              params.get('context')
                ? l(
                    'السياق السابق غير متاح لهذا الملف المهني. مُسحت النتائج السابقة.',
                    'Le contexte précédent n’est pas accessible à ce profil. Les résultats précédents ont été effacés.',
                  )
                : l(
                    'الخيارات المتاحة أعلاه جاهزة دون كتابة طلب. اختر المجال لعرض المعطيات الملائمة.',
                    'Les options ci-dessus sont disponibles sans rédiger de demande. Choisissez un domaine pour afficher ses paramètres.',
                  )
            }
          />
        </Panel>
      )}
      <ActivityDetails activity={detail} onClose={() => setDetail(null)} />
      <ScheduleModal
        key={schedule?.rec.id ?? 'none'}
        rec={schedule?.rec ?? null}
        decision={schedule?.decision}
        onClose={() => setSchedule(null)}
      />
      <Modal
        open={Boolean(review && proposalIsCurrent(data, session, review.rec))}
        onClose={() => setReview(null)}
        title={l('مراجعة مهنية للتوصية', 'Revue professionnelle de la proposition')}
        description={review?.rec.title ? b(review.rec.title) : undefined}
      >
        {review && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const id = run(() =>
                mutate((d, user) =>
                  reviewRecommendation(d, user, review.rec, review.decision, reason),
                ),
              );
              if (id) setReview(null);
            }}
          >
            <div className="dialog-body">
              <Info tone="green">
                {l(
                  'سيُحفظ اختيارك ومبررك في سجل الملف دون قرار توجيه أو ختم تلقائي.',
                  'Votre choix et son motif seront inscrits dans le dossier, sans décision automatique d’orientation ou de clôture.',
                )}
              </Info>
              <Field
                required
                label={
                  review.decision === 'adapted'
                    ? l('التكييف ومبرره', 'Adaptation et motif')
                    : l('مبرر القرار', 'Motif de la décision')
                }
              >
                <textarea
                  required
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </Field>
            </div>
            <div className="dialog-footer">
              <Button variant="secondary" type="button" onClick={() => setReview(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit">
                {l('تأكيد المراجعة المهنية', 'Confirmer la revue professionnelle')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
