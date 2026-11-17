import type { AppData, Case, FormDefinition, FormValues, Language } from '../types';
import { ageAt } from '../utils/date';
export const protectedIdentityFields = new Set([
  'name',
  'birthDate',
  'birthplace',
  'gender',
  'address',
  'phone',
  'father',
  'mother',
  'school',
]);
export function prefillForm(
  form: FormDefinition,
  data: AppData,
  c: Case,
  language: Language,
): FormValues {
  const child = data.children.find((ch) => ch.id === c.childId)!;
  const values: FormValues = { date: data.demoDate };
  const shared: Record<string, string> = {
    caseId: c.id,
    openedAt: c.openedAt,
    referent: data.professionals.find((p) => p.id === c.referentId)?.name[language] ?? '',
    center: data.centers.find((x) => x.id === c.centerId)?.name[language] ?? '',
  };
  for (const field of form.sections.flatMap((s) => s.fields))
    if (field.shared) {
      const val =
        field.shared in shared ? shared[field.shared] : child[field.shared as keyof typeof child];
      if (typeof val === 'string') values[field.key] = val;
      else if (field.shared === 'name') values[field.key] = child.name[language];
    }
  const appointment = data.appointments.find((a) => a.caseId === c.id && !a.completed);
  if (form.id === 'F03' && appointment) {
    values.appointmentDate = appointment.date;
    values.time = appointment.time;
  }
  if (form.id === 'F05')
    values.interventions = data.events
      .filter(
        (e) =>
          e.caseId === c.id &&
          (e.type === 'observation' ||
            (e.type === 'activity' &&
              data.sessions.some((s) => s.id === e.sourceId && s.status === 'completed') &&
              data.events
                .filter(
                  (other) =>
                    other.caseId === c.id &&
                    other.sourceId === e.sourceId &&
                    other.type === 'activity',
                )
                .at(-1)?.id === e.id)),
      )
      .map((e) => ({
        _sourceId: e.id,
        date: e.date.slice(0, 10),
        intervention: e.title[language],
        notes: e.note,
      }));
  if (form.id === 'F06') {
    const sessions = data.sessions.filter(
      (s) => s.participants.some((p) => p.caseId === c.id) && s.status === 'completed',
    );
    values.activities = sessions.map((s) => ({
      time: `${s.date} ${s.time}`,
      group: s.group,
      activity: data.activities.find((a) => a.id === s.activityId)?.title[language] ?? '',
      goals: c.goals
        .filter((g) => s.goalIds.includes(g.id))
        .map((g) => g.description[language])
        .join('، '),
      materials: '',
      notes: s.participants.find((p) => p.caseId === c.id)?.observations ?? '',
    }));
    values.present = sessions.reduce(
      (a, s) => a + s.participants.filter((p) => p.attendance === 'present').length,
      0,
    );
    values.absent = sessions.reduce(
      (a, s) => a + s.participants.filter((p) => p.attendance !== 'present').length,
      0,
    );
  }
  if (form.id === 'F13') {
    values.goals = c.goals
      .filter((g) => g.confirmed)
      .map((g) => g.description[language])
      .join('\n');
    values.months = 6;
    values.programs = data.sessions
      .filter((s) => s.participants.some((p) => p.caseId === c.id))
      .map((s) => ({
        goal: c.goals
          .filter((g) => s.goalIds.includes(g.id))
          .map((g) => g.description[language])
          .join('، '),
        activity: data.activities.find((a) => a.id === s.activityId)?.title[language] ?? '',
        due: s.date,
        professional: data.professionals.find((p) => p.id === s.educatorId)?.name[language] ?? '',
      }));
  }
  return values;
}
export function validateForm(form: FormDefinition, values: FormValues, date: string) {
  const errors: Record<string, string> = {};
  for (const field of form.sections.flatMap((s) => s.fields)) {
    if (field.condition && values[field.condition.field] !== field.condition.value) continue;
    if (field.shared && protectedIdentityFields.has(field.shared)) continue;
    const v = values[field.key];
    if (field.required && (v === undefined || v === '')) errors[field.key] = 'required';
    if (
      field.type === 'number' &&
      v !== undefined &&
      v !== '' &&
      (!Number.isFinite(Number(v)) ||
        (field.min !== undefined && Number(v) < field.min) ||
        (field.max !== undefined && Number(v) > field.max))
    )
      errors[field.key] = 'number';
    if (
      field.key === 'birthDate' &&
      typeof v === 'string' &&
      v &&
      (v > date || ageAt(v, date) < 0 || ageAt(v, date) >= 18)
    )
      errors[field.key] = 'age';
    if (
      /demo.*(id|identity|membership|card)/i.test(field.key) &&
      typeof v === 'string' &&
      v &&
      !v.startsWith('DEMO-')
    )
      errors[field.key] = 'demo';
  }
  return errors;
}
export function formCompleteness(form: FormDefinition, values: FormValues) {
  const fields = form.sections
    .flatMap((s) => s.fields)
    .filter((f) => !f.shared || !protectedIdentityFields.has(f.shared))
    .filter((f) => !f.condition || values[f.condition.field] === f.condition.value);
  const filled = fields.filter((f) => {
    const v = values[f.key];
    return v !== undefined && v !== '' && (typeof v !== 'object' || Object.keys(v).length > 0);
  }).length;
  return Math.round((filled / Math.max(fields.length, 1)) * 100);
}
