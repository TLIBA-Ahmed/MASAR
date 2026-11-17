import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import { useLocale } from '../../i18n';
import { Badge, Empty, Field, Panel, SectionHeading } from '../../components/ui';
import { eventLabels } from './labels';
import { AuthorizedJourneyDocumentLink } from './AuthorizedJourneyDocumentLink';
import type { JourneyEvent } from './types';

export function JourneyTimeline({
  caseId,
  events,
  onSelect,
}: {
  caseId: string;
  events: JourneyEvent[];
  onSelect: (event: JourneyEvent) => void;
}) {
  const { l, b, date } = useLocale();
  const [type, setType] = useState('all'),
    [stage, setStage] = useState('all'),
    [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [selected, setSelected] = useState('');
  const types = useMemo(() => [...new Set(events.map((e) => e.type))], [events]);
  const filtered = events.filter(
    (e) =>
      (type === 'all' || e.type === type) &&
      (stage === 'all' || String(e.stage) === stage) &&
      (!from || e.date.slice(0, 10) >= from) &&
      (!to || e.date.slice(0, 10) <= to),
  );
  return (
    <Panel className="child-journey-timeline">
      <SectionHeading
        title={l('التاريخ الموثق للمرافقة', 'Le fil documenté de l’accompagnement')}
        subtitle={l(
          'اختر حدثاً لإبراز مرحلته على الخريطة.',
          'Sélectionnez un événement pour situer son étape sur la carte.',
        )}
        actions={
          <Badge>
            {filtered.length} {l('أحداث', 'événements')}
          </Badge>
        }
      />
      <div className="journey-timeline-filters">
        <Field label={l('نوع الحدث', 'Type d’événement')}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">{l('كل الأحداث', 'Tous les événements')}</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {b(eventLabels[t] ?? { ar: t, fr: t })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={l('مرحلة الحدث', 'Étape de l’événement')}>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">{l('كل المراحل', 'Toutes les étapes')}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option value={n} key={n}>
                {l('المرحلة', 'Étape')} {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label={l('من', 'Du')}>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={l('إلى', 'Au')}>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      {filtered.length ? (
        <ol className="journey-events">
          {filtered.map((e) => (
            <li key={e.id} className={selected === e.id ? 'selected' : ''}>
              <span className="journey-event-icon">
                <Clock3 size={15} />
              </span>
              <div>
                <button
                  type="button"
                  className="journey-event-title"
                  onClick={() => {
                    setSelected(e.id);
                    onSelect(e);
                  }}
                >
                  <strong>{b(e.title)}</strong>
                  <time>{date(e.date)}</time>
                </button>
                <div className="journey-event-meta">
                  <Badge>{b(eventLabels[e.type] ?? { ar: e.type, fr: e.type })}</Badge>
                  <span>
                    {l('المرحلة', 'Étape')} 0{e.stage}
                  </span>
                  {e.professionalId && <span>{e.professionalId}</span>}
                </div>
                {e.note && <p className="narrative">{e.note}</p>}
                {e.path?.startsWith('/documents/') && e.sourceId ? (
                  <AuthorizedJourneyDocumentLink
                    caseId={caseId}
                    versionId={e.sourceId}
                    path={e.path}
                  >
                    {l('فتح المصدر في الملف', 'Ouvrir la source dans le dossier')}
                    <ArrowUpRight size={13} />
                  </AuthorizedJourneyDocumentLink>
                ) : (
                  e.path && (
                    <Link className="text-link" to={e.path}>
                      {l('فتح المصدر في الملف', 'Ouvrir la source dans le dossier')}
                      <ArrowUpRight size={13} />
                    </Link>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <Empty title={l('لا أحداث ضمن هذه المرشحات', 'Aucun événement pour ces filtres')} />
      )}
    </Panel>
  );
}
