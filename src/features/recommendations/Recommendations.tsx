import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Clock, SlidersHorizontal, Sparkles, Target, X, ArrowUpRight } from 'lucide-react';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { api } from '../../services/api';
import { aiMessage } from '../../services/aiMessages';
import { materialLabels } from '../../config/workflow';
import { centralRecommendationEngine } from '../../services/recommendations';
import type { AssignedGroup } from '../assigned-children/AssignedChildren';
import {
  Badge,
  Button,
  Empty,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  useToast,
} from '../../components/ui';
import type { Recommendation, RecommendationContext, RecommendationConstraints } from '../../types';
interface Generated {
  status: string;
  recommendations: Recommendation[];
  limitations: string[];
  mode?: string;
}
export function Recommendations() {
  const { data, session } = useWorkspace();
  const { l, b, t } = useLocale();
  const [params, setParams] = useSearchParams();
  const [choice, setChoice] = useState(params.get('case') ?? 'CDIS-024');
  const caseId = data.cases.some((c) => c.id === choice) ? choice : (data.cases[0]?.id ?? '');
  const contexts = data.backend?.templates[caseId] ?? [];
  const context = contexts.find((c) => c.contextId === params.get('context'));
  const key = `${session?.sessionId}:${data.backend?.fingerprint}:${caseId}:${data.cases.find((c) => c.id === caseId)?.roadmapVersion}:${context?.contextId ?? ''}:${params.get('activity')}:${params.get('workshop')}`;
  return (
    <>
      <PageHeading
        eyebrow={l('موارد ملائمة / مراجعة مهنية', 'RESSOURCES PERTINENTES / REVUE PROFESSIONNELLE')}
        title={t('recommendations')}
        description={l(
          'محرك مركزي واحد، يتكيّف مع تكليفك والأهداف المؤكدة.',
          'Un moteur central, adapté à votre affectation et aux objectifs confirmés.',
        )}
      />
      <div className="ai-control-row">
        <Field label={l('الملف المأذون', 'Dossier autorisé')}>
          <select
            aria-label={l('اختيار الملف', 'Choisir le dossier')}
            value={caseId}
            onChange={(e) => {
              setChoice(e.target.value);
              setParams({ case: e.target.value });
            }}
          >
            {data.cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
              </option>
            ))}
          </select>
        </Field>
        <Link className="button secondary" to={`/cases/${caseId}?tab=project`}>
          <Target size={16} />
          {l('مراجعة الأهداف والخطة', 'Revoir les objectifs et le plan')}
        </Link>
      </div>
      <div className="studio-contexts">
        {contexts.map((c) => (
          <button
            aria-label={l(c.labelAr, c.labelFr)}
            className={`studio-context ${context?.contextId === c.contextId ? 'active' : ''}`}
            key={c.contextId}
            onClick={() => setParams({ case: caseId, context: c.contextId })}
            aria-pressed={context?.contextId === c.contextId}
          >
            <strong>{l(c.labelAr, c.labelFr)}</strong>
            <small>{b(c.description)}</small>
          </button>
        ))}
      </div>
      {!contexts.length ? (
        <Empty
          title={l(
            'لا توجد سياقات متاحة لهذا التكليف',
            'Aucun contexte disponible pour cette affectation',
          )}
        />
      ) : !context ? (
        <Panel className="studio-empty">
          <Empty
            title={l('اختر مجال التوصيات', 'Choisissez le domaine de recommandation')}
            description={l(
              'لا حاجة إلى كتابة طلب. اختر أحد السياقات المتاحة.',
              'Aucun prompt obligatoire. Choisissez l’un des contextes disponibles.',
            )}
          />
        </Panel>
      ) : (
        <RecommendationStudio key={key} context={context} caseId={caseId} />
      )}
    </>
  );
}
function RecommendationStudio({
  context,
  caseId,
}: {
  context: RecommendationContext;
  caseId: string;
}) {
  const { data, session, refresh } = useWorkspace();
  const { l, b, t, lang } = useLocale();
  const toast = useToast();
  const c = data.cases.find((c) => c.id === caseId)!;
  const [params] = useSearchParams();
  const [groups, setGroups] = useState<AssignedGroup[]>([]),
    [groupId, setGroup] = useState('');
  const [activityId, setActivity] = useState(
    data.activities.some((a) => a.id === params.get('activity')) ? params.get('activity')! : '',
  );
  useEffect(() => {
    const abort = new AbortController();
    void api<{ groups: AssignedGroup[] }>('/me/assigned-groups', undefined, {
      signal: abort.signal,
    })
      .then((r) => setGroups(r.groups))
      .catch(() => undefined);
    return () => abort.abort();
  }, []);
  const fields = [...context.requiredInputs, ...context.optionalInputs];
  const goals = c.goals.filter((g) => g.confirmed && g.confirmedBy && g.confirmedAt);
  const [goalIds, setGoals] = useState(goals.map((g) => g.id)),
    [project, setProject] = useState(''),
    [workshop, setWorkshop] = useState(params.get('workshop') ?? '');
  const [constraints, setConstraints] = useState<RecommendationConstraints>({
    maxDuration: 60,
    format: 'any',
    participants: 1,
    materials: [],
  });
  const [request, setRequest] = useState(''),
    [additional, setAdditional] = useState(''),
    [generated, setGenerated] = useState<Generated | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const [review, setReview] = useState<{
      rec: Recommendation;
      status: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'DEFERRED';
    } | null>(null),
    [reason, setReason] = useState('');
  const current = useRef('');
  const formKey = JSON.stringify([
    session?.sessionId,
    data.backend?.fingerprint,
    caseId,
    context.contextId,
    goalIds,
    project,
    workshop,
    groupId,
    activityId,
    constraints,
    request,
    additional,
    lang,
  ]);
  current.current = formKey;
  const [resultKey, setResultKey] = useState('');
  const visible = generated && resultKey === formKey ? generated : null;
  const materials = [...new Set(data.activities.flatMap((a) => a.materials))];
  const generate = async () => {
    setBusy(true);
    setGenerated(null);
    setError(false);
    const key = formKey;
    try {
      const result = await centralRecommendationEngine.generate({
        caseId,
        contextId: context.contextId,
        language: lang,
        goalIds,
        ...(project ? { projectId: project } : {}),
        ...(workshop ? { workshopId: workshop } : {}),
        ...(groupId ? { groupId } : {}),
        ...(activityId ? { activityId } : {}),
        constraints,
        request,
        additionalConstraints: additional,
      });
      if (current.current === key) {
        setGenerated(result);
        setResultKey(key);
      }
    } catch {
      if (current.current === key) setError(true);
    } finally {
      setBusy(false);
    }
  };
  const feedback = async () => {
    if (!review) return;
    try {
      await centralRecommendationEngine.feedback(review.rec.id, review.status, reason);
      setReview(null);
      setReason('');
      toast(
        l(
          'حُفظ رأيك. لم تتغير الخطة الرسمية.',
          'Votre avis est enregistré. Le plan officiel reste inchangé.',
        ),
      );
      setGenerated((previous) =>
        previous
          ? {
              ...previous,
              recommendations: previous.recommendations.map((r) =>
                r.id === review.rec.id
                  ? {
                      ...r,
                      status:
                        review.status === 'REJECTED'
                          ? 'rejected'
                          : review.status === 'DEFERRED'
                            ? 'deferred'
                            : 'accepted',
                      feedback: reason,
                    }
                  : r,
              ),
            }
          : null,
      );
      await refresh();
    } catch {
      toast(
        l(
          'تعذّر حفظ الرأي. راجع الصلاحيات والأهداف.',
          'Impossible d’enregistrer l’avis. Vérifiez les accès et les objectifs.',
        ),
        true,
      );
    }
  };
  return (
    <div className="recommendation-studio">
      <div className="studio-generation-actions">
        <p>
          {l(
            'راجع الأهداف والمعايير، ثم اضغط على «توليد التوصيات».',
            'Vérifiez les objectifs et les paramètres, puis cliquez sur « Générer les recommandations ».',
          )}
        </p>
        <Button onClick={() => void generate()} disabled={busy}>
          <Sparkles size={17} />
          {busy
            ? l('جارٍ إعداد المقترحات…', 'Préparation des propositions…')
            : l('توليد التوصيات', 'Générer les recommandations')}
        </Button>
      </div>
      <aside>
        <Panel className="studio-form">
          <h2>{l(context.labelAr, context.labelFr)}</h2>
          <p className="backend-status">
            {l('معطيات محدودة ضمن نطاق الوصول', 'Informations limitées au périmètre autorisé')}
          </p>
          {fields.includes('projectId') && (
            <Field label={l('المشروع القائم، اختياري', 'Projet existant, facultatif')}>
              <select value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">{l('الأهداف الحالية للخطة', 'Objectifs actuels du plan')}</option>
                {data.submissions
                  .filter((s) => s.caseId === caseId && ['F13', 'F14'].includes(s.formId))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.formId} · v{s.version}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {fields.includes('workshopId') && (
            <Field label={l('ورشة قائمة، اختياري', 'Atelier existant, facultatif')}>
              <select value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
                <option value="">{l('دون ورشة محددة', 'Sans atelier sélectionné')}</option>
                {data.sessions
                  .filter((s) => s.participants.some((p) => p.caseId === caseId))
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.group || s.id} · {s.date}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          {fields.includes('groupId') && (
            <Field label={l('مجموعة الطفل، اختياري', 'Groupe de l’enfant, facultatif')}>
              <select value={groupId} onChange={(e) => setGroup(e.target.value)}>
                <option value="">{l('دون مجموعة محددة', 'Sans groupe sélectionné')}</option>
                {groups.map((g) => (
                  <option key={g.group_id} value={g.group_id}>
                    {b(g.group_name)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {fields.includes('maxDuration') && (
            <Field label={l('نشاط محدد، اختياري', 'Activité précise, facultative')}>
              <select value={activityId} onChange={(e) => setActivity(e.target.value)}>
                <option value="">
                  {l('كل الأنشطة المؤهلة', 'Toutes les activités éligibles')}
                </option>
                {data.activities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {b(a.title)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {fields.includes('goalIds') && (
            <>
              <h3>{l('أهداف أكدها المهني', 'Objectifs confirmés par un professionnel')}</h3>
              {goals.length ? (
                goals.map((g) => (
                  <label className="studio-goal" key={g.id}>
                    <input
                      type="checkbox"
                      checked={goalIds.includes(g.id)}
                      onChange={() =>
                        setGoals((ids) =>
                          ids.includes(g.id) ? ids.filter((id) => id !== g.id) : [...ids, g.id],
                        )
                      }
                    />
                    {b(g.description)}
                  </label>
                ))
              ) : (
                <p className="backend-status">
                  {l('لم تُؤكد أهداف بعد.', 'Aucun objectif confirmé.')}
                </p>
              )}
            </>
          )}
        </Panel>
        <Panel className="studio-form">
          <h3>
            <SlidersHorizontal size={16} /> {l('معايير السياق', 'Paramètres du contexte')}
          </h3>
          {fields.includes('maxDuration') && (
            <Field label={l('المدة المتاحة بالدقائق', 'Durée disponible en minutes')}>
              <input
                type="number"
                min={5}
                max={240}
                value={constraints.maxDuration}
                onChange={(e) =>
                  setConstraints({ ...constraints, maxDuration: Number(e.target.value) })
                }
              />
            </Field>
          )}
          {fields.includes('format') && (
            <Field label={l('نوع النشاط', 'Format')}>
              <select
                value={constraints.format}
                onChange={(e) =>
                  setConstraints({
                    ...constraints,
                    format: e.target.value as RecommendationConstraints['format'],
                  })
                }
              >
                <option value="any">{t('all')}</option>
                <option value="individual">{t('individual')}</option>
                <option value="group">{t('group')}</option>
              </select>
            </Field>
          )}
          {fields.includes('participants') && (
            <Field label={l('عدد المشاركين المتوقع', 'Effectif envisagé')}>
              <input
                type="number"
                min={1}
                max={30}
                value={constraints.participants}
                onChange={(e) =>
                  setConstraints({ ...constraints, participants: Number(e.target.value) })
                }
              />
            </Field>
          )}
          {fields.includes('materials') && (
            <details>
              <summary>{l('المواد المتاحة', 'Matériel disponible')}</summary>
              {materials.map((m) => (
                <label className="studio-goal" key={m}>
                  <input
                    type="checkbox"
                    checked={constraints.materials.includes(m)}
                    onChange={() =>
                      setConstraints({
                        ...constraints,
                        materials: constraints.materials.includes(m)
                          ? constraints.materials.filter((v) => v !== m)
                          : [...constraints.materials, m],
                      })
                    }
                  />
                  {materialLabels[m] ? b(materialLabels[m]) : m}
                </label>
              ))}
            </details>
          )}
          {fields.includes('request') && (
            <Field label={l('طلب إضافي، اختياري', 'Demande complémentaire, facultative')}>
              <textarea
                maxLength={500}
                value={request}
                onChange={(e) => setRequest(e.target.value)}
              />
            </Field>
          )}
          {fields.includes('constraints') && (
            <Field
              label={l(
                'ملاحظات مهنية إضافية، اختيارية',
                'Précisions professionnelles, facultatives',
              )}
            >
              <textarea
                maxLength={500}
                value={additional}
                onChange={(e) => setAdditional(e.target.value)}
              />
            </Field>
          )}
        </Panel>
      </aside>
      <div>
        <Info>
          {l(
            'مقترحات استشارية. القبول أو التكييف يسجل رأيك فقط؛ تُخطط التدخلات بإجراء مستقل داخل الملف.',
            'Propositions consultatives. Accepter ou adapter enregistre seulement votre avis ; la planification se fait séparément dans le dossier.',
          )}
        </Info>
        {error && (
          <div className="api-error" role="alert">
            {l(
              'تعذّر إتمام الطلب. حدّث السياق ثم حاول مجدداً.',
              'La demande a échoué. Actualisez le contexte puis réessayez.',
            )}
          </div>
        )}
        {visible?.limitations.map((code) => (
          <p className="backend-status" key={code}>
            {aiMessage(code, lang)}
          </p>
        ))}
        {visible?.recommendations.length ? (
          visible.recommendations.map((rec) => (
            <Panel className="proposal-card" key={rec.id}>
              <div className="section-heading">
                <Badge tone="green">
                  {l('أهلية المورد متحققة', 'Éligibilité de la ressource vérifiée')}
                </Badge>
                <Badge>
                  {rec.score}% · {l('ملاءمة المورد', 'pertinence de la ressource')}
                </Badge>
              </div>
              <h2>{b(rec.title!)}</h2>
              <p>{b(rec.summary!)}</p>
              <div className="proposal-reasons">
                {rec.reasons.map((r, i) => (
                  <div key={i}>{b(r)}</div>
                ))}
                {rec.modelExplanation && <p>{rec.modelExplanation}</p>}
              </div>
              <div className="ai-source-list">
                {rec.sources?.map((s) => (
                  <Link key={s.id} to={s.path}>
                    {b(s.label)}
                    <ArrowUpRight size={12} />
                  </Link>
                ))}
              </div>
              {rec.status === 'suggested' ? (
                <div className="proposal-actions">
                  {(
                    [
                      { status: 'ACCEPTED', ar: 'قبول', fr: 'Accepter', icon: Check },
                      { status: 'MODIFIED', ar: 'تكييف', fr: 'Adapter', icon: SlidersHorizontal },
                      { status: 'REJECTED', ar: 'رفض', fr: 'Refuser', icon: X },
                      { status: 'DEFERRED', ar: 'تأجيل', fr: 'Reporter', icon: Clock },
                    ] as const
                  ).map((action) => (
                    <Button
                      variant={action.status === 'ACCEPTED' ? 'primary' : 'secondary'}
                      key={action.status}
                      onClick={() => {
                        setReason('');
                        setReview({ rec, status: action.status });
                      }}
                    >
                      <action.icon size={15} />
                      {l(action.ar, action.fr)}
                    </Button>
                  ))}
                </div>
              ) : (
                <p>
                  <Badge tone="green">
                    {l('حُفظ الرأي المهني', 'Avis professionnel enregistré')}
                  </Badge>
                </p>
              )}
            </Panel>
          ))
        ) : (
          <Panel className="studio-empty">
            <div role={busy ? 'status' : undefined} aria-live="polite">
              <Empty
                title={
                  busy
                    ? l('جارٍ إعداد المقترحات…', 'Préparation des propositions…')
                    : visible
                      ? l('لا توجد مقترحات قابلة للعرض', 'Aucune proposition à afficher')
                      : l('ستظهر المقترحات هنا', 'Les propositions apparaîtront ici')
                }
                description={
                  busy
                    ? l(
                        'قد يستغرق الحساب المحلي بعض الوقت. ستظهر المقترحات عند اكتماله.',
                        'Le calcul local peut prendre un peu de temps. Les propositions s’afficheront une fois terminé.',
                      )
                    : visible
                      ? l(
                          'كل تدخل يظل خاضعاً للتقدير المهني.',
                          'Toute intervention reste soumise au jugement professionnel.',
                        )
                      : l(
                          'راجع الأهداف والمعايير، ثم استخدم زر «توليد التوصيات» أعلاه.',
                          'Vérifiez les objectifs et les paramètres, puis utilisez le bouton « Générer les recommandations » ci-dessus.',
                        )
                }
              />
            </div>
          </Panel>
        )}
      </div>
      <Modal
        open={Boolean(review)}
        onClose={() => setReview(null)}
        title={l('رأيك المهني حول المقترح', 'Votre avis professionnel sur la proposition')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void feedback();
          }}
        >
          <Field label={l('المبرر أو التكييف المقترح', 'Motif ou adaptation proposée')}>
            <textarea
              required
              minLength={3}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Info>
            {l(
              'لا يبرمج هذا الإجراء أي تدخل ولا يغيّر الخطة.',
              'Cette action ne programme aucune intervention et ne modifie pas le plan.',
            )}
          </Info>
          <Button type="submit">{l('حفظ الرأي', 'Enregistrer l’avis')}</Button>
        </form>
      </Modal>
    </div>
  );
}
