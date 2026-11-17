import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { ArrowLeft, ArrowRight, FolderHeart, RefreshCw, Route, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import { Badge, Button, Empty, PageHeading, Panel } from '../../components/ui';
import { AssignedChildrenJourneyOverview } from './AssignedChildrenJourneyOverview';
import { ChildJourneySelector } from './ChildJourneySelector';
import { IntelligentJourneyMap } from './IntelligentJourneyMap';
import { AuthorizedCaseLink } from './AuthorizedCaseLink';
import { StageDetailsDrawer } from './StageDetailsDrawer';
import { ChildEvolutionDashboard } from './ChildEvolutionDashboard';
import { JourneyTimeline } from './JourneyTimeline';
import { RehabilitationCycleHistory } from './RehabilitationCycleHistory';
import { useJourneyResource } from './useJourneyResource';
import { statusLabels } from './labels';
import type { ChildJourney, JourneyOverview } from './types';
import type { Stage } from '../../types';
import './journey.css';
import './summaries.css';

function IndividualJourney({ caseId }: { caseId: string }) {
  const { l, b, date, lang } = useLocale();
  const [params, setParams] = useSearchParams();
  const [drawer, setDrawer] = useState<Stage | null>(null);
  const {
    data: journey,
    error,
    retry,
  } = useJourneyResource<ChildJourney>(`/cases/${encodeURIComponent(caseId)}/journey`);
  const { data: overview } = useJourneyResource<JourneyOverview>('/journeys/assigned');
  const stageParam = Number(params.get('stage'));
  const selected =
    stageParam >= 1 && stageParam <= 5 ? (stageParam as Stage) : (journey?.stage ?? 1);
  function select(stage: Stage, showDetails = true) {
    const next = new URLSearchParams(params);
    next.set('stage', String(stage));
    setParams(next, { replace: true });
    if (showDetails) setDrawer(stage);
  }
  if (error)
    return (
      <Empty
        title={l(
          'هذا المسار غير متاح ضمن نطاق الوصول الحالي',
          'Ce parcours n’est pas disponible dans le périmètre d’accès actuel',
        )}
        description={l(
          'قد يكون التكليف انتهى أو لا توجد صلاحية لقراءة الملف.',
          'L’affectation peut avoir pris fin ou le dossier peut être hors du périmètre autorisé.',
        )}
        action={<Button onClick={retry}>{l('إعادة التحقق', 'Vérifier à nouveau')}</Button>}
      />
    );
  if (!journey)
    return (
      <Panel>
        <p role="status">{l('تحميل المسار المصرح به…', 'Chargement du parcours autorisé…')}</p>
      </Panel>
    );
  const current = journey.checkpoints[journey.stage - 1];
  const total = journey.checkpoints.reduce((sum, s) => sum + s.totalSubsteps, 0);
  const complete = journey.checkpoints.reduce((sum, s) => sum + s.completedSubsteps, 0);
  const completion = total ? Math.round((complete / total) * 100) : 0;
  const hasExtension = journey.cycles.some((c) =>
    c.decisions.some((d) => d.kind === 'extend' && d.from === 4 && d.to === 3),
  );
  return (
    <>
      <div className="journey-breadcrumb">
        <Link to="/child-journey">
          {lang === 'ar' ? <ArrowRight size={14} /> : <ArrowLeft size={14} />}
          {l('كل المسارات', 'Tous les parcours')}
        </Link>
        <span>/</span>
        <span className="mono">{caseId}</span>
        <Badge>{l('ملف اصطناعي', 'Dossier synthétique')}</Badge>
      </div>
      <div className="journey-child-header">
        <div>
          <span className="eyebrow">
            {l('مسار فردي / ملف مركزي واحد', 'PARCOURS INDIVIDUEL / UN DOSSIER CENTRAL')}
          </span>
          <h2>
            <small>{l('رمز الطفل', 'Code enfant')} : </small>
            <span dir="ltr">{journey.child_code ?? b(journey.child.name)}</span>
          </h2>
          <p>
            <span className="mono">{caseId}</span> · {l('فتح في', 'Ouvert le')}{' '}
            {date(journey.openedAt)} · {l('الدورة', 'Cycle')} {journey.cycle}
          </p>
        </div>
        <ChildJourneySelector children={overview?.children ?? []} selected={caseId} />
        <AuthorizedCaseLink className="button primary" caseId={caseId}>
          <FolderHeart size={17} />
          {l('عرض الملف', 'Consulter le dossier')}
        </AuthorizedCaseLink>
        <Button
          variant="secondary"
          onClick={retry}
          aria-label={l('تحديث المسار', 'Actualiser le parcours')}
        >
          <RefreshCw size={17} />
        </Button>
      </div>
      <div className="journey-individual-layout has-intelligent-summary">
        <IntelligentJourneyMap
          caseId={caseId}
          checkpoints={journey.checkpoints}
          selected={selected}
          onSelect={select}
          hasExtension={hasExtension}
        />
        <details className="journey-current-details">
          <summary>
            {l('المرحلة الحالية واكتمال المسار', 'Étape actuelle et complétude du parcours')} ·{' '}
            {b(current.title)} · {completion}%
          </summary>
          <aside className="journey-current-panel">
            <span className="eyebrow">{l('هنا، الآن', 'ICI, MAINTENANT')}</span>
            <span className="journey-current-number">
              0{journey.stage}
              <small>/ 05</small>
            </span>
            <Badge tone="blue">{l('المرحلة الحالية', 'Étape actuelle')}</Badge>
            <h2>{b(current.title)}</h2>
            <p>{b(current.description)}</p>
            {current.future && (
              <Badge tone="orange">
                {l('حالة تاريخية / سير عمل مستقبلي', 'État historique / workflow futur')}
              </Badge>
            )}
            <div className="journey-completeness">
              <div>
                <strong>{completion}%</strong>
                <span>
                  {l('اكتمال المراحل الفرعية الظاهرة', 'Complétude des sous-étapes visibles')}
                </span>
              </div>
              <progress
                value={complete}
                max={total || 1}
                aria-label={l(
                  'اكتمال المراحل الفرعية الموثقة',
                  'Complétude des sous-étapes documentées',
                )}
              />
              <small>
                {complete}/{total} ·{' '}
                {l('ليست نتيجة لتقييم الطفل', 'Ce pourcentage n’évalue pas l’enfant')}
              </small>
            </div>
            {journey.nextDue && (
              <div className="journey-next-due">
                <span>{l('أجل الملف القادم', 'Prochaine échéance du dossier')}</span>
                <strong>{date(journey.nextDue)}</strong>
              </div>
            )}
            <Button onClick={() => select(journey.stage)}>
              {l('استكشاف المرحلة الحالية', 'Explorer l’étape actuelle')}
              <ArrowRight size={16} />
            </Button>
            <ol className="journey-stage-index">
              {journey.checkpoints.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    aria-pressed={selected === s.id}
                    onClick={() => select(s.id)}
                  >
                    <span className={`journey-stage-mini state-${s.status}`}>{s.id}</span>
                    <span>
                      <strong>{b(s.short)}</strong>
                      <small>
                        {b(statusLabels[s.status])}
                        {s.future ? ` · ${l('مستقبلية', 'Future')}` : ''}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="journey-sync-note">
              <ShieldCheck size={16} />
              {l('متصل بالملف المركزي · قراءة فقط', 'Relié au dossier central · Lecture seule')}
            </p>
          </aside>
        </details>
      </div>
      <ChildEvolutionDashboard journey={journey} />
      <RehabilitationCycleHistory journey={journey} />
      <JourneyTimeline
        caseId={caseId}
        events={journey.events}
        onSelect={(event) => select(event.stage, false)}
      />
      <StageDetailsDrawer
        caseId={caseId}
        stage={drawer}
        onClose={() => setDrawer(null)}
        onSelect={(stage) => select(stage)}
      />
    </>
  );
}

export function ChildJourneyPage() {
  const { caseId } = useParams();
  const { l } = useLocale();
  return (
    <div className="child-journey-page">
      <PageHeading
        eyebrow={l('مسار / رؤية تفاعلية', 'MASAR / UNE LECTURE VIVANTE DU PARCOURS')}
        title={l('متابعة مسار الطفل', "Suivi du parcours de l'enfant")}
        description={l(
          'كل خطوة موثقة، وكل قرار يبقى بيد المهنيين.',
          'Chaque étape est documentée. Chaque décision reste entre les mains des professionnels.',
        )}
        actions={
          <span className="journey-module-mark">
            <Route size={20} />
            {l('خمس محطات · مسار واحد', 'Cinq étapes · Un parcours')}
          </span>
        }
      />
      {caseId ? (
        <IndividualJourney key={caseId} caseId={caseId} />
      ) : (
        <AssignedChildrenJourneyOverview />
      )}
    </div>
  );
}
