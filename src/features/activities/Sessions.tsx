import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RecommendationLink } from '../../components/recommendations/RecommendationLink';
import { CheckCheck, Plus } from 'lucide-react';
import type { ActivityParticipation, ActivitySession } from '../../types';
import { useWorkspace } from '../../hooks/useWorkspace';
import { useLocale } from '../../i18n';
import { completeSession } from '../../services/actions';
import {
  Badge,
  Button,
  Empty,
  Field,
  Info,
  Modal,
  PageHeading,
  Panel,
  useAction,
} from '../../components/ui';
function SessionRecord({
  session,
  onClose,
}: {
  session: ActivitySession | null;
  onClose: () => void;
}) {
  const { l, b, t } = useLocale();
  const { data, mutate } = useWorkspace();
  const run = useAction();
  const [participants, setParticipants] = useState<ActivityParticipation[]>(() =>
      structuredClone(session?.participants ?? []),
    ),
    [adaptations, setAdaptations] = useState(session?.adaptations ?? '');
  const readonly = session?.status === 'completed';
  const update = (caseId: string, key: keyof ActivityParticipation, value: string) =>
    setParticipants((prev) => prev.map((p) => (p.caseId === caseId ? { ...p, [key]: value } : p)));
  return (
    <Modal
      wide
      open={Boolean(session)}
      onClose={onClose}
      title={l('سجل الحصة التربوية', 'Compte rendu de séance')}
      description={
        session
          ? `${b(data.activities.find((a) => a.id === session.activityId)!.title)} · ${session.date} ${session.time}`
          : ''
      }
    >
      {session && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const result = run(
              () => {
                mutate((d, s) => completeSession(d, s, session.id, participants, adaptations));
                return true;
              },
              l(
                'حُفظت الحصة وأضيفت ملاحظاتها إلى ملف كل مشارك وF05 وF06.',
                'La séance et ses observations alimentent chaque dossier, F05 et F06.',
              ),
            );
            if (result) onClose();
          }}
        >
          <div className="dialog-body">
            <Info tone="orange">
              {l(
                'محاكاة إنجاز لأغراض العرض. المشاركة تصف هذه الحصة فقط، دون تصنيف دائم للطفل.',
                'Réalisation simulée pour la démonstration. La participation décrit cette séance uniquement, sans étiquette permanente.',
              )}
            </Info>
            {participants.map((p) => {
              const c = data.cases.find((c) => c.id === p.caseId)!;
              const ch = data.children.find((ch) => ch.id === c.childId)!;
              return (
                <section className="participant-record" key={p.caseId}>
                  <h3>
                    {b(ch.name)} <small dir="ltr">{p.caseId}</small>
                  </h3>
                  <div className="form-grid">
                    <Field label={l('الحضور', 'Présence')}>
                      <select
                        disabled={readonly}
                        value={p.attendance}
                        onChange={(e) => update(p.caseId, 'attendance', e.target.value)}
                      >
                        {['present', 'absent', 'excused'].map((status) => (
                          <option key={status} value={status}>
                            {t(status)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={l('المشاركة في هذه الحصة', 'Participation à cette séance')}>
                      <select
                        disabled={readonly}
                        value={p.engagement}
                        onChange={(e) => update(p.caseId, 'engagement', e.target.value)}
                      >
                        <option value="active">{l('مشاركة نشطة', 'Active')}</option>
                        <option value="partial">{l('مشاركة جزئية', 'Partielle')}</option>
                        <option value="observing">{l('في وضع ملاحظة', 'Observation')}</option>
                      </select>
                    </Field>
                    <Field
                      required={p.attendance === 'present'}
                      label={l('الملاحظات المهنية', 'Observations professionnelles')}
                    >
                      <textarea
                        disabled={readonly}
                        required={p.attendance === 'present'}
                        value={p.observations}
                        onChange={(e) => update(p.caseId, 'observations', e.target.value)}
                      />
                    </Field>
                    <Field label={l('التقدم الملاحظ', 'Progrès observés')}>
                      <textarea
                        disabled={readonly}
                        value={p.progress}
                        onChange={(e) => update(p.caseId, 'progress', e.target.value)}
                      />
                    </Field>
                  </div>
                </section>
              );
            })}
            <Field
              label={l('التكييفات والتوصيات للحصة القادمة', 'Adaptations et suites proposées')}
            >
              <textarea
                disabled={readonly}
                value={adaptations}
                onChange={(e) => setAdaptations(e.target.value)}
              />
            </Field>
          </div>
          <div className="dialog-footer">
            <Button variant="secondary" type="button" onClick={onClose}>
              {t('close')}
            </Button>
            {!readonly && (
              <Button type="submit">
                <CheckCheck size={16} />
                {l('تسجيل إنجاز تجريبي', 'Enregistrer la réalisation simulée')}
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}
export function Sessions({ attendance = false }: { attendance?: boolean }) {
  const { l, b, t, date } = useLocale();
  const { data, cases } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(''),
    [caseId, setCaseId] = useState('');
  const ids = new Set(cases.map((c) => c.id));
  const sessions = data.sessions
    .filter(
      (s) =>
        s.participants.every((p) => ids.has(p.caseId)) &&
        (!status || s.status === status) &&
        (!caseId || s.participants.some((p) => p.caseId === caseId)),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const selected = sessions.find((s) => s.id === params.get('session')) ?? null;
  return (
    <>
      <PageHeading
        title={t(attendance ? 'attendance' : 'sessions')}
        description={l(
          'من البرمجة إلى الملاحظة، كل حصة تثري الملف المركزي.',
          'De la planification à l’observation, chaque séance enrichit le dossier central.',
        )}
        actions={
          <RecommendationLink
            contexts={['workshops', 'support-activities']}
            workshopId={selected?.id}
          >
            <Plus size={16} />
            {l('برمجة نشاط', 'Programmer une activité')}
          </RecommendationLink>
        }
      />
      <Panel>
        <div className="table-toolbar">
          <select
            value={status}
            aria-label={l('حالة الحصة', 'Statut de séance')}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">{l('جميع الحالات', 'Tous les statuts')}</option>
            {['planned', 'completed', 'postponed', 'cancelled'].map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
          <select
            value={caseId}
            aria-label={l('ملف الطفل', 'Dossier enfant')}
            onChange={(e) => setCaseId(e.target.value)}
          >
            <option value="">{l('جميع الملفات', 'Tous les dossiers')}</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
              </option>
            ))}
          </select>
          <span className="results-count">
            {sessions.length} {l('حصة', 'séances')}
          </span>
        </div>
        {sessions.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{l('النشاط', 'Activité')}</th>
                  <th>{l('التاريخ والتوقيت', 'Date et heure')}</th>
                  <th>{l('المشاركون', 'Participants')}</th>
                  <th>{l('الحضور / الغياب', 'Présences / absences')}</th>
                  <th>{l('الحالة', 'Statut')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong>
                        {b(data.activities.find((a) => a.id === s.activityId)!.title)}
                      </strong>
                      <small className="table-cell-sub">{s.group || t('individual')}</small>
                    </td>
                    <td>
                      {date(s.date)}
                      <small className="table-cell-sub">{s.time}</small>
                    </td>
                    <td>{s.participants.length}</td>
                    <td>
                      {s.status === 'completed'
                        ? `${s.participants.filter((p) => p.attendance === 'present').length} / ${s.participants.filter((p) => p.attendance !== 'present').length}`
                        : '—'}
                    </td>
                    <td>
                      <Badge tone={s.status === 'completed' ? 'green' : 'blue'}>
                        {t(s.status)}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="secondary" onClick={() => setParams({ session: s.id })}>
                        {s.status === 'completed'
                          ? l('عرض السجل', 'Voir le compte rendu')
                          : l('تسجيل الحصة', 'Renseigner la séance')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('noResults')} />
        )}
      </Panel>
      <SessionRecord
        key={selected?.id ?? 'none'}
        session={selected}
        onClose={() => setParams({})}
      />
    </>
  );
}
