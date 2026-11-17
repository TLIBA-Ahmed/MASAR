import { useNavigate } from 'react-router-dom';
import { useLocale } from '../../i18n';
import { Modal, Info, Button, useAction, Badge } from '../../components/ui';
import { api } from '../../services/api';
import { useJourneyResource } from './useJourneyResource';
import type { StageEvidence } from './summaryTypes';
import type { Stage } from '../../types';

export function StageEvidenceViewer({
  caseId,
  stage,
  summaryId,
  onClose,
}: {
  caseId: string;
  stage: Stage;
  summaryId: string | null;
  onClose: () => void;
}) {
  const { l, b, date } = useLocale();
  const navigate = useNavigate();
  const run = useAction();
  const path = `/cases/${encodeURIComponent(caseId)}/journey/summaries/stages/${stage}/sources${summaryId ? `?summary_id=${encodeURIComponent(summaryId)}` : ''}`;
  const { data, error } = useJourneyResource<{ sources: StageEvidence[] }>(path);
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={l('الأدلة والمصادر المأذونة', 'Preuves et sources autorisées')}
      description={l(
        'مقتطفات مؤرخة محفوظة؛ يُعاد التحقق من كل مصدر عند فتحه.',
        'Extraits datés conservés ; chaque ouverture vérifie à nouveau les droits sur la source.',
      )}
    >
      <div className="dialog-body summary-evidence-list">
        {error ? (
          <Info tone="orange">
            {l(
              'المصادر لم تعد متاحة في نطاقك.',
              'Ces sources ne sont plus disponibles dans votre périmètre.',
            )}
          </Info>
        ) : !data ? (
          <p role="status">{l('التحقق من المصادر…', 'Vérification des sources…')}</p>
        ) : (
          data.sources.map((source) => (
            <article className="summary-source" key={source.reference_id}>
              <div>
                <h3>{b(source.title)}</h3>
                <Badge>v{source.version}</Badge>
              </div>
              <small>{date(source.date)}</small>
              <p className="narrative" dir="auto">
                {b(source.excerpt)}
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  void run(async () => {
                    const result = await api<{ path: string }>(
                      `${path}${summaryId ? '&' : '?'}source_kind=${encodeURIComponent(source.kind)}&source_id=${encodeURIComponent(source.id)}`,
                    );
                    onClose();
                    if (result.path.startsWith('/api/')) window.location.assign(result.path);
                    else navigate(result.path);
                  })
                }
              >
                {l('فتح المصدر بعد التحقق', 'Ouvrir la source après contrôle')}
              </Button>
            </article>
          ))
        )}
        {data && !data.sources.length && (
          <Info>
            {l('لا توجد وثائق مثبتة لهذه المرحلة.', 'Aucune source documentée pour cette étape.')}
          </Info>
        )}
      </div>
    </Modal>
  );
}
