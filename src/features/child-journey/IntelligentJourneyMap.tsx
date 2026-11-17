import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, Maximize2, Minimize2, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../i18n';
import { Button, Info } from '../../components/ui';
import { TunisiaMap3D } from './TunisiaMap3D';
import { JourneySummaryCard } from './JourneySummaryCard';
import { JourneySummaryHistory } from './JourneySummaryHistory';
import { JourneySummaryReviewPanel } from './JourneySummaryReviewPanel';
import { StageEvidenceViewer } from './StageEvidenceViewer';
import { useJourneyResource } from './useJourneyResource';
import type { JourneySummaries } from './summaryTypes';
import type { MapPositions } from './TunisiaScene';
import type { JourneyCheckpointData } from './types';
import type { Stage } from '../../types';

export function IntelligentJourneyMap({
  caseId,
  checkpoints,
  selected,
  onSelect,
  hasExtension,
}: {
  caseId: string;
  checkpoints: JourneyCheckpointData[];
  selected: Stage | null;
  onSelect: (stage: Stage) => void;
  hasExtension: boolean;
}) {
  const { l, lang } = useLocale();
  const { data, error, retry } = useJourneyResource<JourneySummaries>(
    `/cases/${encodeURIComponent(caseId)}/journey/summaries`,
  );
  const [show, setShow] = useState(true),
    [fullscreen, setFullscreen] = useState(false),
    [points, setPoints] = useState<MapPositions>({}),
    [lines, setLines] = useState<{ stage: number; path: string }[]>([]),
    [dialog, setDialog] = useState<{ stage: Stage; kind: 'sources' | 'history' | 'review' } | null>(
      null,
    );
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const change = () => setFullscreen(Boolean(document.fullscreenElement));
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        setFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', change);
    window.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      window.removeEventListener('keydown', escape);
    };
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect(),
        map = element.querySelector('.tunisia-map-viewport')?.getBoundingClientRect();
      if (!map || !show) {
        setLines([]);
        return;
      }
      const result: { stage: number; path: string }[] = [];
      element.querySelectorAll<HTMLElement>('[data-summary-stage]').forEach((card) => {
        const stage = Number(card.dataset.summaryStage),
          point = points[stage];
        if (!point?.visible) return;
        const rect = card.getBoundingClientRect();
        const left = rect.left < map.left;
        const x1 = (left ? rect.right : rect.left) - bounds.left,
          y1 = rect.top + Math.min(65, rect.height / 2) - bounds.top;
        const x2 = map.left - bounds.left + (map.width * point.x) / 100,
          y2 = map.top - bounds.top + (map.height * point.y) / 100;
        result.push({
          stage,
          path: `M${x1},${y1} C${x1 + (left ? 28 : -28)},${y1} ${x2 + (left ? -28 : 28)},${y2} ${x2},${y2}`,
        });
      });
      setLines((previous) =>
        JSON.stringify(previous) === JSON.stringify(result) ? previous : result,
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.querySelectorAll('[data-summary-stage]').forEach((card) => observer.observe(card));
    measure();
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [points, show, data, lang]);
  const leaveFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    setFullscreen(false);
  };
  const open = (stage: Stage, kind: 'sources' | 'history' | 'review') => {
    void leaveFullscreen().then(() => setDialog({ stage, kind }));
  };
  const renderCard = (stage: Stage) => {
    const value = data?.stages.find((s) => s.stage_id === stage);
    return value ? (
      <JourneySummaryCard
        key={stage}
        data={value}
        checkpoint={checkpoints[stage - 1]}
        selected={stage === selected}
        onDetails={(s) => {
          void leaveFullscreen().then(() => onSelect(s));
        }}
        onSources={() => open(stage, 'sources')}
        onHistory={() => open(stage, 'history')}
        onReview={() => open(stage, 'review')}
      />
    ) : null;
  };
  const dialogData = data?.stages.find((s) => s.stage_id === dialog?.stage);
  return (
    <div ref={root} className={`intelligent-journey-map ${fullscreen ? 'is-fullscreen' : ''}`}>
      <div className="journey-story-toolbar">
        <div>
          <ShieldCheck size={16} />
          <strong>{l('قصة مسار موثقة', 'Un parcours raconté par ses preuves')}</strong>
          <small>{l('خمس مراحل · هوية محمية', 'Cinq étapes · identité protégée')}</small>
        </div>
        <div>
          <Button variant="ghost" aria-pressed={show} onClick={() => setShow((v) => !v)}>
            {show ? <EyeOff size={15} /> : <Eye size={15} />}{' '}
            {show
              ? l('إخفاء الملخصات', 'Masquer les synthèses')
              : l('عرض الملخصات', 'Afficher les synthèses')}
          </Button>
          <Button
            variant="ghost"
            aria-label={
              fullscreen
                ? l('الخروج من ملء الشاشة', 'Quitter le plein écran')
                : l('ملء الشاشة', 'Plein écran')
            }
            onClick={() => {
              if (fullscreen) {
                void leaveFullscreen();
              } else if (root.current?.requestFullscreen) {
                void root.current
                  .requestFullscreen()
                  .then(() => setFullscreen(true))
                  .catch(() => setFullscreen(true));
              } else setFullscreen(true);
            }}
          >
            {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
        </div>
      </div>
      {error && (
        <Info tone="orange">
          {l('تعذر جلب الملخصات المأذونة.', 'Impossible de récupérer les synthèses autorisées.')}{' '}
          <Button onClick={retry} variant="ghost">
            {l('إعادة التحقق', 'Vérifier à nouveau')}
          </Button>
        </Info>
      )}
      {show && !data && !error && (
        <p className="journey-summary-loading" role="status">
          {l('تجميع الأدلة المأذونة لكل مرحلة…', 'Rassemblement des preuves autorisées par étape…')}
        </p>
      )}
      <div
        className={`journey-story-grid ${show && data ? 'with-summaries' : 'map-only'}`}
        dir="ltr"
      >
        {show && data && (
          <div className="summary-card-rail rail-start">
            {([1, 2, 3] as Stage[]).map(renderCard)}
          </div>
        )}
        <TunisiaMap3D
          checkpoints={checkpoints}
          selected={selected}
          onSelect={(s) => {
            void leaveFullscreen().then(() => onSelect(s));
          }}
          hasExtension={hasExtension}
          onPositions={setPoints}
        />
        {show && data && (
          <div className="summary-card-rail rail-end">
            {([4, 5] as Stage[]).map(renderCard)}
            <div className="summary-privacy-note" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              <ShieldCheck size={22} />
              <p>
                {l(
                  'المصادقة تعتمد على أدلة مأذونة. غياب المعلومة لا يعني نتيجة سلبية.',
                  'La validation s’appuie sur des sources autorisées. Une information absente ne constitue pas un résultat négatif.',
                )}
              </p>
            </div>
          </div>
        )}
      </div>
      {show && data && (
        <svg className="summary-connectors" aria-hidden="true">
          {lines.map((line) => (
            <path
              key={line.stage}
              d={line.path}
              className={line.stage === selected ? 'selected' : ''}
            />
          ))}
        </svg>
      )}
      {data && dialog && dialogData && dialog.kind === 'sources' && (
        <StageEvidenceViewer
          caseId={caseId}
          stage={dialog.stage}
          summaryId={dialogData.summary.id}
          onClose={() => setDialog(null)}
        />
      )}
      {data && dialog && dialog.kind === 'history' && (
        <JourneySummaryHistory
          caseId={caseId}
          stage={dialog.stage}
          onClose={() => setDialog(null)}
        />
      )}
      {data && dialog && dialogData && dialog.kind === 'review' && (
        <JourneySummaryReviewPanel
          caseId={caseId}
          stage={dialog.stage}
          cycle={dialogData.cycle_id}
          canGenerate={data.permissions.generate}
          canReview={data.permissions.review}
          onChanged={retry}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
