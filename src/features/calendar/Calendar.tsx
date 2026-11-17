import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react';
import { useLocale } from '../../i18n';
import { useWorkspace } from '../../hooks/useWorkspace';
import { addDays, uid } from '../../utils/date';
import { bi } from '../../types';
import type { Appointment } from '../../types';
import { requireCase } from '../../services/auth';
import { recordEvent } from '../../services/actions';
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
export function Calendar() {
  const { l, b, t, date, lang } = useLocale();
  const { data, cases, session, mutate } = useWorkspace();
  const [params] = useSearchParams();
  const linkedAppointment = params.get('appointment');
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '')
    ? params.get('date')!
    : data.demoDate;
  const lastLinkedAppointment = useRef<string | null>(null);
  const [month, setMonth] = useState(data.demoDate.slice(0, 7)),
    [selectedDate, setSelectedDate] = useState(data.demoDate),
    [view, setView] = useState('month'),
    [filter, setFilter] = useState('all'),
    [modal, setModal] = useState(false),
    [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: '',
    caseId: '',
    date: data.demoDate,
    time: '09:00',
    type: 'interview',
    notes: '',
  });
  const run = useAction();
  const ids = new Set(cases.map((c) => c.id));
  const appointments = data.appointments.filter((a) =>
    !a.caseId ? a.professionalId === session!.professionalId : ids.has(a.caseId),
  );
  const sessions = data.sessions.filter((s) => s.participants.every((p) => ids.has(p.caseId)));
  const entries = [
    ...appointments.map((a) => ({
      id: a.id,
      title: a.title,
      date: a.date,
      time: a.time,
      type: a.type,
      caseId: a.caseId,
      status: a.completed ? 'completed' : 'planned',
      appointment: a,
    })),
    ...sessions.map((s) => ({
      id: s.id,
      title: data.activities.find((a) => a.id === s.activityId)!.title,
      date: s.date,
      time: s.time,
      type: 'activity',
      caseId: s.participants[0]?.caseId,
      status: s.status,
      appointment: undefined,
    })),
  ]
    .filter((e) => filter === 'all' || e.type === filter)
    .sort((a, b) => a.time.localeCompare(b.time));
  const first = `${month}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const selectedWeekday = (new Date(`${selectedDate}T12:00:00Z`).getUTCDay() + 6) % 7;
  const start =
    view === 'week' ? addDays(selectedDate, -selectedWeekday) : addDays(first, -weekday);
  const days = Array.from({ length: view === 'week' ? 7 : 42 }, (_, i) => addDays(start, i));
  const names = Array.from({ length: 7 }, (_, i) =>
    date(addDays('2026-11-16', i), { weekday: 'short' }),
  );
  const navigate = (direction: number) => {
    if (view === 'week') {
      const next = addDays(selectedDate, 7 * direction);
      setSelectedDate(next);
      setMonth(next.slice(0, 7));
    } else {
      const d = new Date(`${month}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + direction);
      const next = d.toISOString().slice(0, 7);
      setMonth(next);
      setSelectedDate(`${next}-01`);
    }
  };
  const open = (appointment?: Appointment) => {
    setEditing(appointment?.id ?? null);
    setDraft(
      appointment
        ? {
            title: b(appointment.title),
            caseId: appointment.caseId ?? '',
            date: appointment.date,
            time: appointment.time,
            type: appointment.type,
            notes: appointment.notes,
          }
        : {
            title: '',
            caseId: '',
            date: selectedDate,
            time: '09:00',
            type: 'interview',
            notes: '',
          },
    );
    setModal(true);
  };
  useEffect(() => {
    setMonth(requestedDate.slice(0, 7));
    setSelectedDate(requestedDate);
  }, [requestedDate]);
  useEffect(() => {
    if (!linkedAppointment || lastLinkedAppointment.current === linkedAppointment) return;
    const appointment = data.appointments.find((a) => a.id === linkedAppointment);
    if (!appointment) return;
    lastLinkedAppointment.current = linkedAppointment;
    setEditing(appointment.id);
    setDraft({
      title: appointment.title[lang],
      caseId: appointment.caseId ?? '',
      date: appointment.date,
      time: appointment.time,
      type: appointment.type,
      notes: appointment.notes,
    });
    setModal(true);
  }, [linkedAppointment, data.appointments, lang]);
  return (
    <>
      <PageHeading
        title={t('calendar')}
        description={l(
          'مواعيد وتقييمات وأنشطة من مصدر واحد، متصلة بالملفات.',
          'Rendez-vous, évaluations et activités partagés avec les dossiers.',
        )}
        actions={
          <Button onClick={() => open()}>
            <Plus size={16} />
            {l('موعد جديد', 'Nouveau rendez-vous')}
          </Button>
        }
      />
      <div className="calendar-layout">
        <Panel className="calendar-panel">
          <div className="calendar-toolbar">
            <div className="calendar-month">
              <Button
                variant="ghost"
                onClick={() => navigate(-1)}
                aria-label={l('الفترة السابقة', 'Période précédente')}
              >
                {lang === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </Button>
              <h2>{date(`${month}-01`, { month: 'long', year: 'numeric' })}</h2>
              <Button
                variant="ghost"
                onClick={() => navigate(1)}
                aria-label={l('الفترة القادمة', 'Période suivante')}
              >
                {lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
              </Button>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setMonth(data.demoDate.slice(0, 7));
                setSelectedDate(data.demoDate);
              }}
            >
              {l('تاريخ العرض', 'Date de démo')}
            </Button>
            <div className="segmented-control">
              <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>
                {l('شهر', 'Mois')}
              </button>
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>
                {l('أسبوع', 'Semaine')}
              </button>
            </div>
          </div>
          <div className="calendar-weekdays">
            {names.map((name, i) => (
              <span key={i}>{name}</span>
            ))}
          </div>
          <div className={`calendar-grid ${view === 'week' ? 'week-view' : ''}`}>
            {days.map((day) => {
              const dayEntries = entries.filter((e) => e.date === day);
              return (
                <button
                  className={`calendar-day ${day === selectedDate ? 'selected' : ''} ${day === data.demoDate ? 'today' : ''} ${day.slice(0, 7) !== month ? 'outside' : ''}`}
                  key={day}
                  onClick={() => {
                    setSelectedDate(day);
                    if (view === 'week') setMonth(day.slice(0, 7));
                  }}
                >
                  <span>{Number(day.slice(8))}</span>
                  <div>
                    {dayEntries.slice(0, 3).map((e) => (
                      <span key={e.id} className={`calendar-event ${e.type}`}>
                        <i />
                        {b(e.title)}
                      </span>
                    ))}
                    {dayEntries.length > 3 && <small>+{dayEntries.length - 3}</small>}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
        <aside>
          <Panel className="calendar-agenda">
            <h2>{date(selectedDate, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
            <select
              aria-label={l('نوع الموعد', 'Type d’événement')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">{l('كل المواعيد والأنشطة', 'Tous les événements')}</option>
              {['interview', 'evaluation', 'meeting', 'followUp', 'activity'].map((key) => (
                <option key={key} value={key}>
                  {key === 'activity' ? t('sessions') : t(key)}
                </option>
              ))}
            </select>
            {entries
              .filter((e) => e.date === selectedDate)
              .map((e) => (
                <div className="agenda-detail" key={e.id}>
                  <div>
                    <span>
                      <Clock3 size={13} />
                      {e.time}
                    </span>
                    <Badge tone={e.status === 'completed' ? 'green' : 'blue'}>{t(e.status)}</Badge>
                  </div>
                  <h3>{b(e.title)}</h3>
                  {e.caseId && <Link to={`/cases/${e.caseId}`}>{e.caseId}</Link>}
                  <div className="agenda-detail-actions">
                    {e.appointment ? (
                      <>
                        <Button variant="secondary" onClick={() => open(e.appointment)}>
                          {l('تعديل', 'Modifier')}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() =>
                            run(() =>
                              mutate((d) => {
                                const a = d.appointments.find((a) => a.id === e.id)!;
                                a.completed = !a.completed;
                              }),
                            )
                          }
                        >
                          {e.appointment.completed
                            ? l('إعادة فتح', 'Rouvrir')
                            : l('تم الموعد', 'Marquer terminé')}
                        </Button>
                      </>
                    ) : (
                      <Link className="button secondary" to={`/sessions?session=${e.id}`}>
                        {l('متابعة الحصة', 'Suivre la séance')}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            {!entries.some((e) => e.date === selectedDate) && (
              <Empty
                title={l('يوم دون مواعيد', 'Aucun rendez-vous')}
                description={l(
                  'اختر يوماً آخر أو أضف موعداً.',
                  'Choisissez un autre jour ou ajoutez un rendez-vous.',
                )}
              />
            )}
          </Panel>
        </aside>
      </div>
      <Modal
        wide
        open={modal}
        onClose={() => setModal(false)}
        title={
          editing
            ? l('تعديل موعد', 'Modifier le rendez-vous')
            : l('برمجة موعد جديد', 'Planifier un rendez-vous')
        }
        description={l(
          'يُحفظ الموعد محلياً ويظهر في الملف المعني.',
          'Le rendez-vous est conservé localement et associé au dossier.',
        )}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const result = run(() => {
              mutate((d, s) => {
                if (!draft.title.trim()) throw Error('VALIDATION');
                const c = draft.caseId ? requireCase(d, s, draft.caseId) : undefined;
                const id = editing ?? uid('appointment');
                const old = d.appointments.find((a) => a.id === editing);
                const item: Appointment = {
                  id,
                  caseId: draft.caseId || undefined,
                  title: bi(draft.title, draft.title),
                  type: draft.type as Appointment['type'],
                  date: draft.date,
                  time: draft.time,
                  professionalId: s.professionalId,
                  completed: old?.completed ?? false,
                  notes: draft.notes,
                };
                d.appointments = d.appointments.filter((a) => a.id !== id);
                d.appointments.push(item);
                if (c)
                  recordEvent(
                    d,
                    c,
                    s,
                    'observation',
                    bi('تحديث موعد المتابعة', 'Rendez-vous de suivi actualisé'),
                    `${draft.title} · ${draft.date} ${draft.time}`,
                    id,
                  );
              });
              return true;
            });
            if (result) setModal(false);
          }}
        >
          <div className="dialog-body form-grid">
            <div className="full-span">
              <Field label={l('عنوان الموعد', 'Intitulé')} required>
                <input
                  required
                  value={draft.title}
                  onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
                />
              </Field>
            </div>
            <Field label={l('الملف المرتبط', 'Dossier associé')}>
              <select
                value={draft.caseId}
                onChange={(e) => setDraft((p) => ({ ...p, caseId: e.target.value }))}
              >
                <option value="">{l('موعد مهني عام', 'Événement professionnel général')}</option>
                {cases
                  .filter((c) => c.status === 'active')
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {b(data.children.find((ch) => ch.id === c.childId)!.name)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={l('نوع الموعد', 'Type')}>
              <select
                value={draft.type}
                onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value }))}
              >
                {['interview', 'evaluation', 'meeting', 'followUp'].map((key) => (
                  <option key={key} value={key}>
                    {t(key)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={l('التاريخ', 'Date')} required>
              <input
                required
                type="date"
                value={draft.date}
                onChange={(e) => setDraft((p) => ({ ...p, date: e.target.value }))}
              />
            </Field>
            <Field label={l('الوقت', 'Heure')} required>
              <input
                required
                type="time"
                value={draft.time}
                onChange={(e) => setDraft((p) => ({ ...p, time: e.target.value }))}
              />
            </Field>
            <div className="full-span">
              <Field label={l('ملاحظات', 'Observations')}>
                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                />
              </Field>
            </div>
          </div>
          <div className="dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function Tasks() {
  const { l, b, t, date } = useLocale();
  const { data, cases, mutate, session } = useWorkspace();
  const [params] = useSearchParams();
  const [done, setDone] = useState('open'),
    [open, setOpen] = useState(false),
    [title, setTitle] = useState(''),
    [due, setDue] = useState(data.demoDate),
    [caseId, setCaseId] = useState('');
  const run = useAction();
  const ids = new Set(cases.map((c) => c.id));
  const tasks = data.tasks
    .filter(
      (task) =>
        (task.professionalId === session!.professionalId ||
          (task.caseId && ids.has(task.caseId))) &&
        (params.get('task') === task.id || done === 'all' || task.completed === (done === 'done')),
    )
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <>
      <PageHeading
        title={t('tasks')}
        description={l(
          'كل إجراء صغير يحافظ على استمرارية المسار.',
          'Chaque action contribue à la continuité du parcours.',
        )}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            {l('مهمة جديدة', 'Nouvelle tâche')}
          </Button>
        }
      />
      <div className="segmented-control task-filter">
        {[
          ['open', l('قيد المتابعة', 'À suivre')],
          ['done', l('منجزة', 'Terminées')],
          ['all', t('all')],
        ].map(([key, label]) => (
          <button className={done === key ? 'active' : ''} key={key} onClick={() => setDone(key)}>
            {label}
          </button>
        ))}
      </div>
      <Panel className="task-list">
        {tasks.length ? (
          tasks.map((task) => (
            <div
              id={`task-${task.id}`}
              className={`task-item ${task.completed ? 'done' : ''} ${params.get('task') === task.id ? 'target-resource' : ''}`}
              key={task.id}
            >
              <input
                aria-label={b(task.title)}
                type="checkbox"
                checked={task.completed}
                onChange={() =>
                  run(() =>
                    mutate((d) => {
                      const target = d.tasks.find((t) => t.id === task.id)!;
                      target.completed = !target.completed;
                    }),
                  )
                }
              />
              <div>
                <strong>{b(task.title)}</strong>
                <small>
                  {task.caseId && <Link to={`/cases/${task.caseId}`}>{task.caseId} · </Link>}
                  {date(task.dueDate)}
                </small>
              </div>
              {!task.completed && task.dueDate < data.demoDate ? (
                <Badge tone="orange">{l('موعد منقضٍ', 'Échéance dépassée')}</Badge>
              ) : (
                <Badge tone={task.completed ? 'green' : 'neutral'}>
                  {task.completed ? t('completed') : t('planned')}
                </Badge>
              )}
            </div>
          ))
        ) : (
          <Empty
            title={l('كل شيء منظم هنا', 'Tout est en ordre')}
            description={l('لا توجد مهام في هذه القائمة.', 'Aucune tâche dans cette liste.')}
          />
        )}
      </Panel>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={l('مهمة متابعة جديدة', 'Nouvelle tâche de suivi')}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              mutate((d, s) => {
                if (caseId) requireCase(d, s, caseId);
                d.tasks.push({
                  id: uid('task'),
                  title: bi(title, title),
                  caseId: caseId || undefined,
                  dueDate: due,
                  completed: false,
                  professionalId: s.professionalId,
                });
              }),
            );
            setOpen(false);
            setTitle('');
          }}
        >
          <div className="dialog-body">
            <Field required label={l('عنوان المهمة', 'Intitulé')}>
              <input required value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <Field label={l('موعد الإنجاز', 'Échéance')}>
              <input type="date" required value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label={l('الملف', 'Dossier')}>
              <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
                <option value="">{l('مهمة عامة', 'Tâche générale')}</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="dialog-footer">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="submit">{t('save')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
