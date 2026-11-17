import { useLocale } from '../../i18n';
import { statusLabels } from './labels';
import type { JourneyCheckpointData } from './types';

export function JourneyCheckpointTooltip({ checkpoint: s }: { checkpoint: JourneyCheckpointData }) {
  const { l, b, date } = useLocale();
  return (
    <span className="journey-checkpoint-tooltip" role="tooltip" id={`checkpoint-tip-${s.id}`}>
      <strong>{b(s.title)}</strong>
      <span>
        {s.childCount !== undefined
          ? l('عرض جماعي للملفات المصرح بها', 'Vue collective des dossiers autorisés')
          : b(statusLabels[s.status])}
        {s.future ? ` · ${l('سير عمل مستقبلي', 'Workflow futur')}` : ''}
      </span>
      {s.childCount !== undefined ? (
        <span>
          {s.childCount} {l('أطفال ضمن النطاق', 'enfants dans le périmètre')}
        </span>
      ) : (
        <>
          <span>
            {l('البداية', 'Début')} :{' '}
            {s.startedAt ? date(s.startedAt) : l('غير موثق', 'Non documenté')}
          </span>
          <span>
            {l('النهاية', 'Fin')} : {s.endedAt ? date(s.endedAt) : l('غير موثقة', 'Non documentée')}
          </span>
          <span>
            {s.completedSubsteps}/{s.totalSubsteps}{' '}
            {l('مراحل فرعية موثقة', 'sous-étapes documentées')} · {s.documentCount}{' '}
            {l('وثائق', 'documents')}
          </span>
        </>
      )}
    </span>
  );
}
