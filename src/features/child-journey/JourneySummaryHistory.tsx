import { useState } from 'react';
import { useLocale } from '../../i18n';
import { Modal, Info, Badge, Button } from '../../components/ui';
import { useJourneyResource } from './useJourneyResource';
import { StageEvidenceViewer } from './StageEvidenceViewer';
import { generationLabel } from './summaryTypes';
import type { JourneyStageSummary } from './summaryTypes';
import type { Stage } from '../../types';

export function JourneySummaryHistory({
  caseId,
  stage,
  onClose,
}: {
  caseId: string;
  stage: Stage;
  onClose: () => void;
}) {
  const { l, lang, date } = useLocale();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const { data, error } = useJourneyResource<{ versions: JourneyStageSummary[] }>(
    `/cases/${caseId}/journey/summaries/stages/${stage}/history`,
  );
  return (
    <>
      <Modal
        open
        onClose={onClose}
        wide
        title={l('النسخ التاريخية للملخص', 'Historique des synthèses')}
        description={l(
          'لا تستبدل النسخة الجديدة الملخص السابق. تبقى كل دورة مستقلة.',
          'Chaque nouvelle version conserve les précédentes ; les cycles restent distincts.',
        )}
      >
        <div className="dialog-body summary-history-list">
          {error ? (
            <Info tone="orange">
              {l('السجل غير متاح ضمن نطاقك.', 'Historique indisponible dans votre périmètre.')}
            </Info>
          ) : !data ? (
            <p role="status">{l('تحميل…', 'Chargement…')}</p>
          ) : (
            data.versions.map((v) => (
              <article key={v.id} className="summary-source">
                <div>
                  <strong>
                    {l('الدورة', 'Cycle')} {v.cycle_id} · v{v.version}
                  </strong>
                  <Badge tone={v.validation_status === 'approved' ? 'green' : 'orange'}>
                    {v.validation_status === 'approved'
                      ? l('مصادق عليها', 'Approuvée')
                      : v.validation_status === 'rejected'
                        ? l('مرفوضة', 'Rejetée')
                        : l('مسودة', 'Brouillon')}
                  </Badge>
                </div>
                <small>
                  {date(v.generated_at ?? '')} ·{' '}
                  {generationLabel(v.generation_method, lang === 'ar')}
                  {v.model_version ? ` · ${v.model_version}` : ''}
                </small>
                <p className="narrative" dir="auto">
                  {lang === 'ar' ? v.summary_ar : v.summary_fr}
                </p>
                {v.validated_at && (
                  <p>
                    {l('المصادقة المهنية', 'Revue professionnelle')} · {v.validated_by} ·{' '}
                    {date(v.validated_at)} · <span dir="auto">{v.review_reason}</span>
                  </p>
                )}
                <Button variant="secondary" onClick={() => setSourceId(v.id)}>
                  {l('مصادر هذه النسخة', 'Sources de cette version')}
                </Button>
              </article>
            ))
          )}
          {data && !data.versions.length && (
            <Info>{l('لم تحفظ نسخة بعد.', 'Aucune version enregistrée pour le moment.')}</Info>
          )}
        </div>
      </Modal>
      {sourceId && data?.versions.some((v) => v.id === sourceId) && (
        <StageEvidenceViewer
          caseId={caseId}
          stage={stage}
          summaryId={sourceId}
          onClose={() => setSourceId(null)}
        />
      )}
    </>
  );
}
