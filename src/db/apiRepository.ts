import type { AppData, SessionContext } from '../types';
import { api } from '../services/api';
const changed = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
/** Original components emit explicit commands; protected snapshots are never uploaded. */
export class ApiRepository {
  load() {
    return api<AppData>('/workspace');
  }
  flush() {
    return Promise.resolve();
  }
  async commit(before: AppData, after: AppData, session: SessionContext) {
    for (const child of after.children) {
      const old = before.children.find((c) => c.id === child.id);
      const c = after.cases.find((c) => c.childId === child.id);
      if (!old || !c) continue;
      if (
        after.submissions.some((s) =>
          changed(
            before.submissions.find((x) => x.id === s.id),
            s,
          ),
        )
      )
        continue;
      const changes = Object.fromEntries(
        Object.entries(child).filter(([key, value]) =>
          changed(old[key as keyof typeof old], value),
        ),
      );
      if (Object.keys(changes).length)
        await api(`/cases/${c.id}/identity`, { changes }, { method: 'PATCH' });
    }
    for (const form of after.submissions) {
      if (
        !changed(
          before.submissions.find((s) => s.id === form.id),
          form,
        )
      )
        continue;
      await api('/forms', {
        id: form.id,
        caseId: form.caseId,
        formId: form.formId,
        values: form.values,
        status: form.status,
        language: document.documentElement.lang === 'fr' ? 'fr' : 'ar',
      });
    }
    for (const c of after.cases) {
      const old = before.cases.find((x) => x.id === c.id);
      if (!old) throw Error('USE_CASE_REGISTRATION_API');
      if (changed([old.goals, old.projectNotes], [c.goals, c.projectNotes]))
        await api(
          `/cases/${c.id}/roadmap`,
          { goals: c.goals, notes: c.projectNotes, expected_version: old.roadmapVersion ?? 1 },
          { method: 'PUT' },
        );
      if (
        changed(
          [old.stage, old.status, old.supervised, old.subStages],
          [c.stage, c.status, c.supervised, c.subStages],
        )
      )
        throw Error('LATER_LIFECYCLE_DEFERRED');
    }
    for (const e of after.events) {
      if (before.events.some((x) => x.id === e.id) || e.type !== 'observation') continue;
      const old = before.cases.find((x) => x.id === e.caseId),
        current = after.cases.find((x) => x.id === e.caseId);
      if (changed(old?.projectNotes, current?.projectNotes)) continue;
      if (
        after.submissions.some(
          (s) => !before.submissions.some((x) => x.id === s.id) && e.sourceId === s.id,
        )
      )
        continue;
      await api(`/cases/${e.caseId}/observations`, {
        note: e.note,
        category:
          session.role === 'psychologist'
            ? 'psychological'
            : session.role === 'social'
              ? 'social'
              : 'educational',
      });
    }
    for (const kind of ['tasks', 'appointments'] as const)
      for (const item of after[kind])
        if (
          changed(
            before[kind].find((i) => i.id === item.id),
            item,
          )
        )
          await api(`/records/${kind}`, item);
    for (const s of after.sessions)
      if (
        changed(
          before.sessions.find((x) => x.id === s.id),
          s,
        )
      )
        await api(`/sessions/${s.id}`, s, { method: 'PUT' });
    if (after.activities.some((a) => !before.activities.some((x) => x.id === a.id)))
      throw Error('CATALOGUE_REVIEW_REQUIRED');
  }
}
export const apiRepository = new ApiRepository();
