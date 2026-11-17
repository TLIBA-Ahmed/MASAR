import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Clock3,
  FileText,
  LockKeyhole,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../i18n';
import { Badge, Button, Empty, IconButton, Info } from '../../components/ui';
import { useJourneyResource } from './useJourneyResource';
import { AuthorizedJourneyDocumentLink } from './AuthorizedJourneyDocumentLink';
import { statusLabels, eventLabels } from './labels';
import type { JourneyStageDetails } from './types';
import type { Stage } from '../../types';
import { workflowRules } from '../../config/workflow';

export function StageDetailsDrawer({
  caseId,
  stage,
  onClose,
  onSelect,
}: {
  caseId: string;
  stage: Stage | null;
  onClose: () => void;
  onSelect: (stage: Stage) => void;
}) {
  const { l, b, date, t } = useLocale();
  const { data, error, retry } = useJourneyResource<JourneyStageDetails>(
    stage ? `/cases/${caseId}/journey/stages/${stage}` : null,
  );
  const s = data?.checkpoint;
  const rubrics =
    stage === 1
      ? ['identity', 'interviews', 'social']
      : stage === 2
        ? ['educational', 'multidisciplinary', 'documents']
        : stage === 3
          ? ['project', 'interventions', 'activities']
          : ['history', 'documents'];
  const rubricLabels: Record<string, [string, string]> = {
    identity: ['الهوية', 'Identité'],
    interviews: ['المحادثات', 'Entretiens'],
    social: ['الوضعية الاجتماعية', 'Situation sociale'],
    educational: ['التربية', 'Éducation'],
    multidisciplinary: ['تقييم متعدد الاختصاصات', 'Évaluation pluridisciplinaire'],
    documents: ['الوثائق', 'Documents'],
    project: ['المشروع الفردي', 'Projet individualisé'],
    interventions: ['التدخلات', 'Interventions'],
    activities: ['الأنشطة والحضور', 'Activités et présences'],
    history: ['التاريخ', 'Historique'],
  };
  return (
    <Dialog.Root
      open={stage !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="journey-drawer-overlay" />
        <Dialog.Content
          className="journey-stage-drawer"
          aria-describedby="journey-stage-description"
        >
          <header className="journey-drawer-header">
            <div>
              <span className="eyebrow">
                {caseId} / {l('المرحلة', 'ÉTAPE')} 0{stage}
              </span>
              <Dialog.Title>
                {s ? b(s.title) : l('تفاصيل المرحلة', 'Détails de l’étape')}
              </Dialog.Title>
              <Dialog.Description id="journey-stage-description">
                {s
                  ? b(s.description)
                  : l(
                      'قراءة المعلومات المصرح بها من الملف المركزي.',
                      'Lecture des informations autorisées du dossier central.',
                    )}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <IconButton label={l('إغلاق تفاصيل المرحلة', 'Fermer les détails de l’étape')}>
                <X size={20} />
              </IconButton>
            </Dialog.Close>
          </header>
          <div className="journey-drawer-scroll">
            {error ? (
              <Empty
                title={l(
                  'المرحلة غير متاحة ضمن نطاق الوصول الحالي',
                  'Étape indisponible dans le périmètre d’accès actuel',
                )}
                action={<Button onClick={retry}>{l('إعادة المحاولة', 'Réessayer')}</Button>}
              />
            ) : !s || !data ? (
              <p role="status">{t('loading')}</p>
            ) : (
              <>
                <div className="journey-stage-summary">
                  <Badge tone={s.current ? 'blue' : s.status === 'completed' ? 'green' : 'neutral'}>
                    {b(statusLabels[s.status])}
                  </Badge>
                  <span>
                    {s.completedSubsteps}/{s.totalSubsteps}{' '}
                    {l('مراحل فرعية موثقة', 'sous-étapes documentées')}
                  </span>
                  <span>
                    {s.documentCount} {l('وثائق', 'documents')}
                  </span>
                </div>
                {s.future && (
                  <Info tone="orange">
                    {l(
                      'سير العمل المتقدم مستقبلي في النموذج التجريبي. تبقى العناصر التاريخية المصرح بها قابلة للقراءة فقط.',
                      'Le workflow avancé est futur dans ce PoC. Les éléments historiques autorisés restent consultables en lecture seule.',
                    )}
                  </Info>
                )}
                {(stage === 2 || stage === 3) && (
                  <p className="muted small">
                    {stage === 2
                      ? l('مدة الملاحظة الإرشادية', 'Durée indicative d’observation')
                      : l('مدة التأهيل الإرشادية', 'Durée indicative de réhabilitation')}{' '}
                    :{' '}
                    {stage === 2
                      ? workflowRules.observationMonths
                      : workflowRules.suggestedRehabilitationMonths}{' '}
                    {l(
                      'أشهر · إعداد قابل للتغيير في النموذج التجريبي',
                      'mois · paramètre configurable du PoC',
                    )}
                  </p>
                )}
                <section>
                  <h3>{l('المهنيون المساهمون', 'Professionnels contributeurs')}</h3>
                  <div className="journey-professionals">
                    {data.professionals.length ? (
                      data.professionals.map((p) => (
                        <span key={p.id}>
                          <strong>{b(p.name)}</strong>
                          <small>{t(p.role)}</small>
                        </span>
                      ))
                    ) : (
                      <p className="muted">
                        {l(
                          'لا مساهمات مسجلة ضمن هذا النطاق.',
                          'Aucune contribution enregistrée dans ce périmètre.',
                        )}
                      </p>
                    )}
                  </div>
                </section>
                <section>
                  <h3>{l('المراحل الفرعية', 'Sous-étapes')}</h3>
                  <ul className="journey-substeps">
                    {s.substeps.map((step) => {
                      const complete = ['completed', 'validated', 'notApplicable'].includes(
                        step.status,
                      );
                      const Icon = complete
                        ? Check
                        : step.status === 'unavailable'
                          ? LockKeyhole
                          : step.status === 'pending'
                            ? Clock3
                            : Circle;
                      return (
                        <li key={step.key} className={complete ? 'complete' : ''}>
                          <Icon size={17} />
                          <div>
                            <strong>{b(step.title)}</strong>
                            <small>
                              {b(
                                statusLabels[step.status as keyof typeof statusLabels] ??
                                  statusLabels.notStarted,
                              )}
                            </small>
                          </div>
                          {step.status !== 'unavailable' && (
                            <Link to={step.path}>{l('فتح', 'Ouvrir')}</Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <section>
                  <h3>{l('الاستمارات والوثائق المرتبطة', 'Formulaires et documents associés')}</h3>
                  <div className="journey-form-links">
                    {data.forms.map((f) => (
                      <Link key={f.id} to={f.path}>
                        <FileText size={15} />
                        <strong>{f.id}</strong>
                        <span>{b(f.title)}</span>
                      </Link>
                    ))}
                  </div>
                  {s.documents.length ? (
                    <ul className="journey-document-list">
                      {s.documents.map((d) => (
                        <li key={d.id}>
                          <div>
                            <strong>
                              {d.formId} · v{d.version}
                            </strong>
                            <small>
                              {date(d.date)} ·{' '}
                              {b(
                                statusLabels[d.status as keyof typeof statusLabels] ??
                                  statusLabels.completed,
                              )}
                            </small>
                          </div>
                          <AuthorizedJourneyDocumentLink
                            caseId={caseId}
                            versionId={d.id}
                            path={d.path}
                          >
                            {l('فتح النسخة', 'Ouvrir la version')}
                          </AuthorizedJourneyDocumentLink>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      {l(
                        'لا وثائق متاحة لهذه المرحلة.',
                        'Aucun document disponible pour cette étape.',
                      )}
                    </p>
                  )}
                </section>
                {(
                  [
                    'observation',
                    'assessment',
                    'activity',
                    'intervention',
                    'project',
                    'decision',
                    'integration',
                  ] as const
                ).map((kind) => {
                  const events = s.events.filter((e) => e.type === kind);
                  return events.length ? (
                    <section key={kind}>
                      <h3>{b(eventLabels[kind])}</h3>
                      {events.map((e) => (
                        <article className="journey-drawer-event" key={e.id}>
                          <strong>{b(e.title)}</strong>
                          <small>
                            {date(e.date)}
                            {e.professionalId ? ` · ${e.professionalId}` : ''}
                          </small>
                          {e.note && <p className="narrative">{e.note}</p>}
                          {e.path?.startsWith('/documents/') && e.sourceId ? (
                            <AuthorizedJourneyDocumentLink
                              caseId={caseId}
                              versionId={e.sourceId}
                              path={e.path}
                            >
                              {l('الرجوع إلى المصدر', 'Consulter la source')}
                            </AuthorizedJourneyDocumentLink>
                          ) : (
                            e.path && (
                              <Link className="text-link" to={e.path}>
                                {l('الرجوع إلى المصدر', 'Consulter la source')}
                              </Link>
                            )
                          )}
                        </article>
                      ))}
                    </section>
                  ) : null;
                })}
                <section>
                  <h3>{l('النتائج الموثقة', 'Résultats documentés')}</h3>
                  {data.results.length ? (
                    data.results.map((result) => (
                      <article className="journey-drawer-event" key={result.id}>
                        <small>{date(result.date)}</small>
                        <p className="narrative">{result.text}</p>
                      </article>
                    ))
                  ) : (
                    <p className="muted">
                      {l(
                        'لا نتائج مسجلة صراحة ضمن نطاق الوصول لهذه المرحلة.',
                        'Aucun résultat explicitement enregistré dans le périmètre d’accès de cette étape.',
                      )}
                    </p>
                  )}
                </section>
                <section>
                  <h3>{l('المواعيد والإجراءات المبرمجة', 'Échéances et actions programmées')}</h3>
                  {data.deadlines.length ? (
                    <ul className="journey-deadlines">
                      {data.deadlines.map((d) => (
                        <li key={d.id}>
                          <time>{date(d.date)}</time>
                          <Link to={d.path}>{b(d.title)}</Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      {l('لا إجراء مبرمج متاح.', 'Aucune action programmée disponible.')}
                    </p>
                  )}
                </section>
                <section>
                  <h3>{l('الفتح في الملف المركزي', 'Ouvrir dans le dossier central')}</h3>
                  <div className="journey-drawer-links">
                    {rubrics.map((tab) => (
                      <Link
                        key={tab}
                        className="button secondary"
                        to={`/cases/${caseId}?tab=${tab}`}
                      >
                        {l(...rubricLabels[tab])}
                      </Link>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
          <footer className="journey-drawer-footer">
            <Button
              variant="secondary"
              disabled={!stage || stage === 1}
              onClick={() => stage && onSelect((stage - 1) as Stage)}
            >
              <ArrowLeft size={15} />
              {l('السابقة', 'Précédente')}
            </Button>
            <Button
              variant="secondary"
              disabled={!stage || stage === 5}
              onClick={() => stage && onSelect((stage + 1) as Stage)}
            >
              {l('التالية', 'Suivante')}
              <ArrowRight size={15} />
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
