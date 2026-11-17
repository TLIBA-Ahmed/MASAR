import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageHeading,
  Panel,
  useAction,
} from '../../components/ui';
import { recordEvent } from '../../services/actions';
import { requireCase } from '../../services/auth';
import { RecommendationLink } from '../../components/recommendations/RecommendationLink';
import { bi } from '../../types';
export function Interventions() {
  const { l, b, t, date } = useLocale();
  const { data, cases, mutate } = useWorkspace();
  const [caseId, setCaseId] = useState(''),
    [open, setOpen] = useState(false),
    [draftCase, setDraftCase] = useState('CDIS-024'),
    [note, setNote] = useState('');
  const run = useAction();
  const ids = new Set(cases.map((c) => c.id));
  const events = data.events
    .filter(
      (e) =>
        ids.has(e.caseId) &&
        (!caseId || e.caseId === caseId) &&
        (e.type === 'observation' || e.type === 'activity'),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <PageHeading
        title={t('interventions')}
        description={l(
          'ملاحظات مهنية تحفظ استمرارية المتابعة.',
          'Des observations qui préservent la continuité du suivi.',
        )}
        actions={
          <div className="heading-actions">
            <RecommendationLink
              contexts={['social-intervention', 'support-activities']}
              caseId={caseId || undefined}
            >
              {t('recommendations')}
            </RecommendationLink>
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              {l('تدخل جديد', 'Nouvelle intervention')}
            </Button>
          </div>
        }
      />
      <Panel>
        <div className="table-toolbar">
          <select
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            aria-label={l('الملف', 'Dossier')}
          >
            <option value="">{l('جميع الملفات', 'Tous les dossiers')}</option>
            {cases.map((c) => (
              <option value={c.id} key={c.id}>
                {c.id}
              </option>
            ))}
          </select>
          <span className="results-count">
            {events.length} {l('ملاحظات وتدخلات', 'observations et interventions')}
          </span>
        </div>
        {events.length ? (
          events.map((e) => (
            <div className="intervention-item" key={e.id}>
              <div>
                <Badge>{e.caseId}</Badge>
                <strong>{b(e.title)}</strong>
                <time>{date(e.date)}</time>
              </div>
              <p className="narrative">{e.note}</p>
              <Link className="text-link" to={`/cases/${e.caseId}?tab=history`}>
                {l('المصدر في الملف المركزي', 'Source dans le dossier central')}
              </Link>
            </div>
          ))
        ) : (
          <Empty title={t('noResults')} />
        )}
      </Panel>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={l('إضافة تدخل وملاحظة', 'Ajouter une intervention')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const result = run(() => {
              mutate((d, s) => {
                const c = requireCase(d, s, draftCase);
                if (c.status !== 'active') throw Error('INACTIVE');
                recordEvent(
                  d,
                  c,
                  s,
                  'observation',
                  bi('تدخل وملاحظة مهنية', 'Intervention et observation professionnelle'),
                  note,
                );
              });
              return true;
            });
            if (result) {
              setOpen(false);
              setNote('');
            }
          }}
        >
          <div className="dialog-body">
            <Field label={l('الملف', 'Dossier')}>
              <select value={draftCase} onChange={(e) => setDraftCase(e.target.value)}>
                {cases
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={l('التدخل والملاحظات', 'Intervention et observations')} required>
              <textarea required rows={5} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div className="dialog-footer">
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
