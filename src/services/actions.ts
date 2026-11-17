import { bi } from '../types';
import type {
  AppData,
  Case,
  Child,
  FormDefinition,
  FormSubmission,
  FormValues,
  JourneyEvent,
  Language,
  Recommendation,
  SessionContext,
  Stage,
  ActivitySession,
} from '../types';
import { requireCase } from './auth';
import { uid, isoNow, addDays, ageAt } from '../utils/date';
import { stages, workflowRules } from '../config/workflow';
import { validateForm } from './forms';
import { accessPolicyService } from './accessPolicy';
import { centralRecommendationEngine } from '../legacy/recommendations';
export function recordEvent(
  data: AppData,
  c: Case,
  session: SessionContext,
  type: JourneyEvent['type'],
  title: JourneyEvent['title'],
  note = '',
  sourceId?: string,
) {
  const eventId = uid('event');
  data.events.push({
    id: eventId,
    caseId: c.id,
    date: isoNow(),
    type,
    title,
    note,
    professionalId: session.professionalId,
    stage: c.stage,
    sourceId,
  });
  return eventId;
}
export function createCase(
  data: AppData,
  session: SessionContext,
  input: Pick<Child, 'name' | 'birthDate' | 'gender' | 'address' | 'father' | 'mother'> & {
    source: string;
    familyId?: string;
  },
) {
  if (session.role !== 'social') throw Error('SOCIAL_ONLY');
  if (
    !input.name.ar.trim() ||
    !Number.isFinite(ageAt(input.birthDate, data.demoDate)) ||
    ageAt(input.birthDate, data.demoDate) < 0 ||
    ageAt(input.birthDate, data.demoDate) >= 18
  )
    throw Error('VALIDATION');
  const numeric = Math.max(0, ...data.cases.map((c) => Number(c.id.slice(5)) || 0)) + 1;
  const id = `CDIS-${String(numeric).padStart(3, '0')}`;
  const familyId = input.familyId || uid('family');
  if (input.familyId && !data.families.some((f) => f.id === input.familyId))
    throw Error('VALIDATION');
  const child: Child = {
    id: uid('child'),
    name: input.name,
    birthDate: input.birthDate,
    gender: input.gender,
    address: input.address,
    father: input.father,
    mother: input.mother,
    birthplace: '',
    phone: 'DEMO-PHONE',
    school: '',
    education: '',
    familyId,
    preferences: [],
  };
  data.children.push(child);
  if (!input.familyId)
    data.families.push({
      id: familyId,
      label: bi(`أسرة ${id} — تجريبية`, `Famille ${id} — fictive`),
      members: [],
      notes: '',
    });
  const c: Case = {
    id,
    childId: child.id,
    centerId: session.centerId,
    referentId: session.professionalId,
    openedAt: data.demoDate,
    stage: 1,
    status: 'active',
    nextDue: addDays(data.demoDate, 7),
    source: input.source,
    cycle: 1,
    goals: [],
    decisions: [],
    subStages: {},
    supervised: false,
    projectNotes: '',
  };
  data.cases.push(c);
  data.professionals
    .filter((p) => p.centerId === session.centerId && p.id !== 'p6')
    .forEach((p) => data.assignments.push({ caseId: id, professionalId: p.id }));
  recordEvent(
    data,
    c,
    session,
    'registration',
    bi('إنشاء الملف الرقمي المركزي', 'Création du dossier central'),
    input.source,
  );
  return id;
}
export function saveSubmission(
  data: AppData,
  session: SessionContext,
  caseId: string,
  form: FormDefinition,
  values: FormValues,
  status: FormSubmission['status'],
  language: Language,
) {
  const c = requireCase(data, session, caseId);
  if (
    !accessPolicyService.canRead(data, session, accessPolicyService.formResource(form.id, caseId))
  )
    throw Error('ACCESS');
  if (c.status !== 'active') throw Error('INACTIVE');
  if (status !== 'draft' && Object.keys(validateForm(form, values, data.demoDate)).length)
    throw Error('VALIDATION');
  const prior = data.submissions.filter((s) => s.caseId === caseId && s.formId === form.id);
  const draft = prior.find((s) => s.status === 'draft');
  const submission: FormSubmission = {
    id: draft?.id ?? uid('document'),
    caseId,
    formId: form.id,
    values: structuredClone(values),
    status,
    date: isoNow(),
    authorId: session.professionalId,
    version: draft?.version ?? Math.max(0, ...prior.map((s) => s.version)) + 1,
    definitionVersion: form.version,
  };
  if (draft) data.submissions = data.submissions.map((s) => (s.id === draft.id ? submission : s));
  else data.submissions.push(submission);
  if (status !== 'draft') {
    const child = data.children.find((ch) => ch.id === c.childId)!;
    for (const field of form.sections.flatMap((s) => s.fields)) {
      if (field.condition && values[field.condition.field] !== field.condition.value) continue;
      const value = values[field.key];
      if (typeof value !== 'string' || !field.shared) continue;
      if (field.shared === 'name') child.name[language] = value;
      else if (
        [
          'birthDate',
          'birthplace',
          'address',
          'phone',
          'education',
          'school',
          'father',
          'mother',
        ].includes(field.shared)
      )
        Object.assign(child, { [field.shared]: value });
    }
    recordEvent(
      data,
      c,
      session,
      form.id === 'F08' || form.id === 'F12' || form.id === 'F02' ? 'assessment' : 'document',
      bi(
        `${form.id} — ${status === 'validated' ? 'مصادقة تجريبية' : 'إتمام الوثيقة'}`,
        `${form.id} — ${status === 'validated' ? 'validation simulée' : 'document complété'}`,
      ),
      `v${submission.version}`,
      submission.id,
    );
    if (form.id === 'F05' && Array.isArray(submission.values.interventions))
      for (const row of submission.values.interventions as Record<string, string>[]) {
        if (row._sourceId && data.events.some((event) => event.id === row._sourceId)) continue;
        if (row.intervention)
          row._sourceId = recordEvent(
            data,
            c,
            session,
            'observation',
            bi('متابعة تربوية F05', 'Suivi éducatif F05'),
            `${row.date ?? ''} — ${row.intervention} ${row.notes ?? ''}`,
            submission.id,
          );
      }
  }
  return submission.id;
}
export function decide(
  data: AppData,
  session: SessionContext,
  caseId: string,
  kind: 'advance' | 'extend' | 'close' | 'supervise' | 'archive',
  reason: string,
) {
  const c = requireCase(data, session, caseId);
  if (!reason.trim()) throw Error('REASON');
  if (c.status !== 'active') throw Error('INACTIVE');
  if (
    (kind === 'supervise' || kind === 'close' || kind === 'extend') &&
    session.role !== 'administration'
  )
    throw Error('ADMIN_ONLY');
  const from = c.stage;
  let to: Stage = c.stage;
  if (kind === 'advance') {
    if (c.stage >= 5) throw Error('TRANSITION');
    to = (c.stage + 1) as Stage;
    for (let j = 0; j < stages[c.stage - 1].subStages.length; j++)
      c.subStages[`${c.stage}-${j}`] = 'validated';
    c.stage = to;
    c.nextDue = addDays(data.demoDate, to === 2 ? 30 : to === 3 ? 180 : 14);
  } else if (kind === 'extend') {
    if (c.stage !== 4) throw Error('TRANSITION');
    to = 3;
    c.stage = 3;
    c.cycle++;
    c.supervised = false;
    c.nextDue = addDays(data.demoDate, 180);
    stages[2].subStages.forEach((_, i) => {
      c.subStages[`3-${i}`] = 'notStarted';
    });
  } else if (kind === 'close') {
    if (c.stage !== 5) throw Error('TRANSITION');
    if (
      workflowRules.requireIntegrationOrJustificationToClose &&
      !data.integrations.some((i) => i.caseId === c.id && i.result.trim()) &&
      !reason.includes('[N/A]')
    )
      throw Error('INTEGRATION_REQUIRED');
    c.status = 'closed';
  } else if (kind === 'supervise') {
    if (c.stage !== 3) throw Error('TRANSITION');
    c.supervised = true;
    c.subStages['3-2'] = 'validated';
  } else c.status = 'archived';
  c.decisions.push({
    id: uid('decision'),
    kind,
    from,
    to,
    date: isoNow(),
    professionalId: session.professionalId,
    reason,
    cycle: c.cycle,
  });
  const titles = {
    advance: bi('انتقال مصادق عليه في المسار', 'Transition de parcours confirmée'),
    extend: bi('تمديد مهني وفتح دورة جديدة', 'Prolongation et nouveau cycle'),
    close: bi('قرار مهني بختم الملف', 'Décision de clôture'),
    supervise: bi('مصادقة الإشراف الإداري', 'Supervision administrative confirmée'),
    archive: bi('أرشفة تجريبية للملف', 'Archivage simulé du dossier'),
  };
  recordEvent(data, c, session, 'decision', titles[kind], reason);
}
export function scheduleRecommendation(
  data: AppData,
  session: SessionContext,
  rec: Recommendation,
  date: string,
  time: string,
  participants: string[],
  adaptations: string,
  decision: 'accepted' | 'adapted' = 'accepted',
) {
  centralRecommendationEngine.validateProposal(data, session, rec);
  if (rec.kind !== 'activity' || !accessPolicyService.hasPermissions(session, ['workshop.plan']))
    throw Error('ACCESS');
  const c = requireCase(data, session, rec.caseId);
  if (c.status !== 'active') throw Error('INACTIVE');
  const existing = data.recommendations.find((r) => r.id === rec.id && r.status === 'accepted');
  if (existing?.sessionId) return existing.sessionId;
  if (workflowRules.requireSupervisionBeforeInterventions && !c.supervised)
    throw Error('SUPERVISION');
  const activity = data.activities.find((a) => a.id === rec.activityId);
  if (
    !activity ||
    !rec.goalIds.length ||
    !rec.goalIds.every((id) => c.goals.some((g) => g.id === id && g.confirmed))
  )
    throw Error('GOALS');
  const allIds = [...new Set([c.id, ...(rec.targetCaseIds ?? []), ...participants])];
  if (allIds.length < activity.minParticipants || allIds.length > activity.maxParticipants)
    throw Error('PARTICIPANTS');
  for (const id of allIds) {
    const participant = requireCase(data, session, id);
    if (!participant.goals.some((g) => g.confirmed && activity.skills.includes(g.skill)))
      throw Error('GOALS');
    if (workflowRules.requireSupervisionBeforeInterventions && !participant.supervised)
      throw Error('SUPERVISION');
    const child = data.children.find((ch) => ch.id === participant.childId)!;
    if (
      participant.status !== 'active' ||
      ageAt(child.birthDate, data.demoDate) < activity.minAge ||
      ageAt(child.birthDate, data.demoDate) > activity.maxAge
    )
      throw Error('PARTICIPANTS');
  }
  if (!date || date < data.demoDate || !/^\d{2}:\d{2}$/.test(time)) throw Error('DATE');
  if (!adaptations.trim()) throw Error('REASON');
  const s: ActivitySession = {
    id: uid('session'),
    activityId: rec.activityId,
    date,
    time,
    educatorId: session.professionalId,
    group: allIds.length > 1 ? 'مجموعة تجريبية' : '',
    participants: allIds.map((caseId) => ({
      caseId,
      attendance: 'present',
      engagement: 'active',
      observations: '',
      progress: '',
    })),
    status: 'planned',
    adaptations,
    goalIds: rec.goalIds,
    recommendationId: rec.id,
  };
  data.sessions.push(s);
  data.recommendations = data.recommendations.filter((r) => r.id !== rec.id);
  data.recommendations.push({
    ...rec,
    status: 'accepted',
    sessionId: s.id,
    feedback: adaptations,
    reviewedBy: session.userId,
    reviewedAt: isoNow(),
    humanDecision: decision,
    date: isoNow(),
  });
  for (const id of allIds)
    recordEvent(
      data,
      requireCase(data, session, id),
      session,
      'activity',
      bi('برمجة نشاط تربوي بقرار مهني', 'Activité planifiée après validation humaine'),
      `${activity.title.ar} · ${date} ${time}\n${adaptations}`,
      s.id,
    );
  return s.id;
}
export function reviewRecommendation(
  data: AppData,
  session: SessionContext,
  rec: Recommendation,
  decision: 'accepted' | 'adapted' | 'rejected' | 'deferred',
  reason: string,
) {
  centralRecommendationEngine.validateProposal(data, session, rec);
  if (!reason.trim()) throw Error('REASON');
  if (rec.kind === 'activity' && (decision === 'accepted' || decision === 'adapted'))
    throw Error('VALIDATION');
  if (data.recommendations.some((r) => r.id === rec.id && r.status === 'accepted')) return rec.id;
  const status = decision === 'adapted' ? 'accepted' : decision;
  const reviewed: Recommendation = {
    ...rec,
    status,
    feedback: reason,
    humanDecision: decision,
    reviewedBy: session.userId,
    reviewedAt: isoNow(),
  };
  const targets = (rec.targetCaseIds ?? (rec.caseId ? [rec.caseId] : [])).map((id) =>
    requireCase(data, session, id),
  );
  if (targets.some((c) => c.status !== 'active')) throw Error('INACTIVE');
  data.recommendations = data.recommendations.filter((r) => r.id !== rec.id);
  data.recommendations.push(reviewed);
  for (const c of targets)
    recordEvent(
      data,
      c,
      session,
      'recommendation',
      decision === 'rejected'
        ? bi('رفض مهني لتوصية', 'Recommandation refusée par le professionnel')
        : decision === 'deferred'
          ? bi('تأجيل مهني لتوصية', 'Recommandation reportée par le professionnel')
          : decision === 'adapted'
            ? bi('تكييف توصية بعد مراجعة بشرية', 'Recommandation adaptée après revue humaine')
            : bi('توصية معتمدة بعد مراجعة بشرية', 'Recommandation retenue après revue humaine'),
      `${rec.contextId} · ${rec.title?.ar ?? rec.id}\n${reason}`,
      rec.id,
    );
  return rec.id;
}
export function completeSession(
  data: AppData,
  session: SessionContext,
  sessionId: string,
  participants: ActivitySession['participants'],
  adaptations: string,
) {
  const s = data.sessions.find((s) => s.id === sessionId);
  if (!s) throw Error('NOT_FOUND');
  if (s.status === 'completed') return;
  if (
    !participants.length ||
    new Set(participants.map((p) => p.caseId)).size !== participants.length ||
    participants.some((p) => !s.participants.some((x) => x.caseId === p.caseId))
  )
    throw Error('PARTICIPANTS');
  for (const p of participants) {
    const c = requireCase(data, session, p.caseId);
    if (c.status !== 'active') throw Error('INACTIVE');
    if (p.attendance === 'present' && !p.observations.trim()) throw Error('OBSERVATION');
  }
  if (participants.length !== s.participants.length) throw Error('PARTICIPANTS');
  s.participants = structuredClone(participants);
  s.adaptations = adaptations;
  s.status = 'completed';
  for (const p of participants)
    recordEvent(
      data,
      requireCase(data, session, p.caseId),
      session,
      'activity',
      bi('حصة منجزة ومتابعة تربوية F05 / F06', 'Séance réalisée et suivi F05 / F06'),
      `${p.attendance} · ${p.observations}\n${p.progress}`,
      s.id,
    );
}
