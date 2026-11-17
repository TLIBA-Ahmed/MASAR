import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  FileSearch,
  History,
  LockKeyhole,
  ArrowUpRight,
  Clock3,
} from 'lucide-react';
import { useLocale } from '../../i18n';
import { Badge } from '../../components/ui';
import { statusLabels } from './labels';
import { summarySections, generationLabel } from './summaryTypes';
import type { StageSummaryCardData, SummarySection } from './summaryTypes';
import type { JourneyCheckpointData } from './types';
import type { Stage } from '../../types';

export function JourneySummaryCard({
  data,
  checkpoint,
  selected,
  onDetails,
  onSources,
  onHistory,
  onReview,
}: {
  data: StageSummaryCardData;
  checkpoint: JourneyCheckpointData;
  selected: boolean;
  onDetails: (stage: Stage) => void;
  onSources: () => void;
  onHistory: () => void;
  onReview: () => void;
}) {
  const { l, b, date, lang } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const summary = data.summary;
  const period = summary.period ?? data.period;
  const populated = (Object.keys(summarySections) as SummarySection[]).filter(
    (k) => k !== 'situation' && summary.sections[k]?.length,
  );
  return (
    <article
      data-summary-stage={data.stage_id}
      className={`journey-summary-card state-${data.status} ${selected ? 'is-selected' : ''} ${checkpoint.current ? 'is-current' : ''}`}
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <div className="summary-card-heading">
        <span className="summary-step-number">{data.stage_id.toString().padStart(2, '0')}</span>
        <div>
          <h3>{b(checkpoint.title)}</h3>
          <span className="summary-card-state">
            {data.status === 'completed' ? <CheckCircle2 size={12} /> : <Clock3 size={12} />}{' '}
            {b(statusLabels[data.status])} · {l('الدورة', 'Cycle')} {data.cycle_id}
          </span>
        </div>
      </div>
      <div className="summary-card-period">
        {period.start ? date(period.start) : l('بداية غير موثقة', 'Début non documenté')}
        {period.end ? ` — ${date(period.end)}` : ''}
      </div>
      <p className={`summary-card-narrative narrative ${expanded ? 'expanded' : ''}`} dir="auto">
        {lang === 'ar' ? summary.summary_ar : summary.summary_fr}
      </p>
      <dl className="summary-card-facts">
        {populated.slice(0, expanded ? undefined : 5).map((key) => (
          <div key={key}>
            <dt>{b(summarySections[key])}</dt>
            <dd className={expanded ? 'expanded' : ''} dir="auto">
              {b(summary.sections[key][0].text)}
            </dd>
          </div>
        ))}
      </dl>
      {populated.length === 0 && (
        <p className="summary-no-evidence">
          {l('الملاحظات والنتائج غير متاحة بعد.', 'Observations et résultats en attente.')}
        </p>
      )}
      <button
        type="button"
        className="summary-expand"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <ChevronDown size={13} />
        {expanded
          ? l('اختصار', 'Réduire')
          : l('عرض الملاحظات والأهداف', 'Développer les observations et objectifs')}
      </button>
      <div className="summary-provenance">
        <LockKeyhole size={11} />
        <span>{generationLabel(summary.generation_method, lang === 'ar')}</span>
      </div>
      <div className="summary-validation">
        <Badge tone={summary.validation_status === 'approved' ? 'green' : 'orange'}>
          {summary.validation_status === 'approved'
            ? l('مصادق عليها مهنياً', 'Validée professionnellement')
            : l('غير معتمدة · للمراجعة', 'Non approuvée · à relire')}
        </Badge>
        {data.update_available && <span>{l('توجد معلومات أحدث', 'Données plus récentes')}</span>}
      </div>
      <div className="summary-card-actions">
        <button type="button" onClick={() => onDetails(data.stage_id)}>
          <ArrowUpRight size={13} />
          {l('التفاصيل', 'Détails')}
        </button>
        <button type="button" onClick={onSources}>
          <FileSearch size={13} />
          {l('المصادر', 'Sources')} <span>{summary.source_references.length}</span>
        </button>
        <button
          type="button"
          onClick={onHistory}
          aria-label={l('تاريخ ملخص المرحلة', 'Historique de la synthèse')}
        >
          <History size={13} />
          {data.history_count}
        </button>
      </div>
      <button type="button" className="summary-review-link" onClick={onReview}>
        {data.latest_draft
          ? l('مراجعة المسودة', 'Relire le brouillon')
          : data.update_available
            ? l('اقتراح نسخة جديدة', 'Proposer une nouvelle version')
            : l('إعداد ومراجعة الملخص', 'Préparer et relire la synthèse')}
      </button>
    </article>
  );
}
