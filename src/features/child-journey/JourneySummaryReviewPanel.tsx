import { useState } from 'react';
import { useLocale } from '../../i18n';
import { Modal, Info, Button, Field, Badge } from '../../components/ui';
import { api } from '../../services/api';
import { useJourneyResource } from './useJourneyResource';
import { StageEvidenceViewer } from './StageEvidenceViewer';
import { generationLabel } from './summaryTypes';
import type { JourneyStageSummary } from './summaryTypes';
import type { Stage } from '../../types';

export function JourneySummaryReviewPanel({
  caseId,
  stage,
  cycle,
  canGenerate,
  canReview,
  onChanged,
  onClose,
}: {
  caseId: string;
  stage: Stage;
  cycle: number;
  canGenerate: boolean;
  canReview: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const { l, lang, date } = useLocale();
  const [reason, setReason] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState(''),
    [sources, setSources] = useState(false),
    [manual, setManual] = useState(false),
    [ar, setAr] = useState(''),
    [fr, setFr] = useState('');
  const {
    data,
    error: accessError,
    retry,
  } = useJourneyResource<{ versions: JourneyStageSummary[] }>(
    `/cases/${caseId}/journey/summaries/stages/${stage}/history?cycle_id=${cycle}`,
  );
  const draft = data?.versions.find((v) => v.validation_status === 'draft');
  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    setError('');
    try {
      await action();
      retry();
      onChanged();
    } catch {
      setError(
        l(
          'تعذر الإجراء؛ قد تكون الصلاحيات أو المصادر قد تغيرت.',
          'Opération refusée : les droits ou les sources ont pu changer.',
        ),
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Modal
        open
        onClose={onClose}
        wide
        title={l('إعداد الملخص ومراجعته', 'Préparation et revue professionnelle')}
        description={l(
          'المسودة ليست قراراً ولا تُنشر كملخص معتمد قبل المصادقة الصريحة.',
          'Le brouillon ne constitue pas une décision. Seule une validation explicite publie une synthèse approuvée.',
        )}
      >
        <div className="dialog-body summary-review-panel">
          {accessError ? (
            <Info tone="orange">
              {l(
                'لم يعد الوصول إلى السجل متاحاً.',
                'L’accès à cet historique n’est plus disponible.',
              )}
            </Info>
          ) : (
            <>
              <Info>
                {l(
                  'يُستخدم Qwen3 عبر البوابة المحلية القائمة. عند عدم توفره تُحفظ صياغة حتمية مع تعريف واضح للوضع.',
                  'Qwen3 utilise la passerelle locale existante. Une synthèse déterministe clairement identifiée prend le relais en cas d’indisponibilité.',
                )}
              </Info>
              {canGenerate && (
                <>
                  <Button
                    disabled={pending}
                    onClick={() =>
                      void run(() =>
                        api(`/cases/${caseId}/journey/summaries/stages/${stage}`, {
                          cycle_id: cycle,
                        }),
                      )
                    }
                  >
                    {pending
                      ? l('جار الإعداد…', 'Préparation en cours…')
                      : l('إنشاء مسودة موثقة جديدة', 'Générer un nouveau brouillon sourcé')}
                  </Button>{' '}
                  <Button variant="secondary" onClick={() => setManual((v) => !v)}>
                    {l('تحرير مهني يدوي', 'Rédaction manuelle')}
                  </Button>
                </>
              )}
              {manual && canGenerate && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(() =>
                      api(`/cases/${caseId}/journey/summaries/stages/${stage}`, {
                        cycle_id: cycle,
                        manual: { ar, fr },
                      }),
                    );
                  }}
                >
                  <Field
                    label={l('ملخص عربي مرتبط بالمصادر', 'Synthèse arabe fondée sur les sources')}
                  >
                    <textarea
                      required
                      maxLength={2000}
                      dir="rtl"
                      value={ar}
                      onChange={(e) => setAr(e.target.value)}
                    />
                  </Field>
                  <Field
                    label={l(
                      'ملخص فرنسي مرتبط بالمصادر',
                      'Synthèse française fondée sur les sources',
                    )}
                  >
                    <textarea
                      required
                      maxLength={2000}
                      dir="ltr"
                      value={fr}
                      onChange={(e) => setFr(e.target.value)}
                    />
                  </Field>
                  <Button disabled={pending}>
                    {l('حفظ مسودة يدوية', 'Enregistrer le brouillon manuel')}
                  </Button>
                </form>
              )}
              {draft ? (
                <article className="summary-source">
                  <div>
                    <h3>
                      {l('مسودة', 'Brouillon')} v{draft.version} · {l('الدورة', 'Cycle')}{' '}
                      {draft.cycle_id}
                    </h3>
                    <Badge tone="orange">{l('غير مصادق عليها', 'Non approuvé')}</Badge>
                  </div>
                  <small>
                    {generationLabel(draft.generation_method, lang === 'ar')} ·{' '}
                    {date(draft.generated_at ?? '')}
                    {draft.model_version ? ` · ${draft.model_version}` : ''}
                  </small>
                  <p className="narrative" dir="auto">
                    {lang === 'ar' ? draft.summary_ar : draft.summary_fr}
                  </p>
                  <Button variant="secondary" onClick={() => setSources(true)}>
                    {l('مراجعة الأدلة أولاً', 'Consulter les preuves')}
                  </Button>
                  {canReview && (
                    <>
                      <Field
                        label={l('تعليل المراجعة المهنية', 'Motif de la revue professionnelle')}
                      >
                        <textarea
                          minLength={3}
                          maxLength={1000}
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </Field>
                      <div className="heading-actions">
                        <Button
                          disabled={pending || reason.trim().length < 3}
                          onClick={() =>
                            void run(() =>
                              api(`/cases/${caseId}/journey/summaries/${draft.id}/review`, {
                                status: 'approved',
                                reason,
                              }),
                            )
                          }
                        >
                          {l('المصادقة ونشر النسخة', 'Approuver et publier la version')}
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={pending || reason.trim().length < 3}
                          onClick={() =>
                            void run(() =>
                              api(`/cases/${caseId}/journey/summaries/${draft.id}/review`, {
                                status: 'rejected',
                                reason,
                              }),
                            )
                          }
                        >
                          {l('رفض المسودة', 'Rejeter le brouillon')}
                        </Button>
                      </div>
                    </>
                  )}
                </article>
              ) : (
                <Info>
                  {l('لا توجد مسودة في انتظار المراجعة.', 'Aucun brouillon en attente de revue.')}
                </Info>
              )}
              {!canGenerate && !canReview && (
                <Info tone="orange">
                  {l(
                    'هذا التكليف يسمح بالقراءة فقط.',
                    'Cette affectation permet uniquement la consultation.',
                  )}
                </Info>
              )}
            </>
          )}
          {error && <Info tone="orange">{error}</Info>}
        </div>
      </Modal>
      {sources && draft && (
        <StageEvidenceViewer
          caseId={caseId}
          stage={stage}
          summaryId={draft.id}
          onClose={() => setSources(false)}
        />
      )}
    </>
  );
}
