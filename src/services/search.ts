import type { AppData, Bi, ResourceKind, SessionContext } from '../types';
import { bi } from '../types';
import { forms } from '../data/form-definitions';
import { accessPolicyService } from './accessPolicy';
import { addDays } from '../utils/date';

const normalizeCharacter = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}-]+/gu, ' ');
export const normalize = (text: string) => normalizeCharacter(text).replace(/\s+/g, ' ').trim();

/** Original string offsets: highlighting never changes narratives or injects HTML. */
export function matchRanges(text: string, query: string): { start: number; end: number }[] {
  let normalized = '';
  const offsets: { start: number; end: number }[] = [];
  let offset = 0;
  for (const character of text) {
    const part = normalizeCharacter(character);
    normalized += part;
    for (let i = 0; i < part.length; i++)
      offsets.push({ start: offset, end: offset + character.length });
    if (!part && offsets.length) offsets[offsets.length - 1].end = offset + character.length;
    offset += character.length;
  }
  const ranges: { start: number; end: number }[] = [];
  for (const term of normalize(query).split(' ').filter(Boolean)) {
    let index = normalized.indexOf(term);
    while (index !== -1) {
      ranges.push({ start: offsets[index].start, end: offsets[index + term.length - 1].end });
      index = normalized.indexOf(term, index + term.length);
    }
  }
  return ranges
    .sort((a, b) => a.start - b.start)
    .reduce<typeof ranges>((all, range) => {
      const last = all.at(-1);
      if (last && last.end >= range.start) last.end = Math.max(last.end, range.end);
      else all.push({ ...range });
      return all;
    }, []);
}
export const searchCategories: Record<ResourceKind, Bi> = {
  case: bi('ملفات الأطفال', 'Dossiers des enfants'),
  form: bi('الاستمارات', 'Formulaires'),
  document: bi('الوثائق', 'Documents'),
  observation: bi('الملاحظات', 'Observations'),
  evaluation: bi('التقييمات', 'Évaluations'),
  project: bi('المشاريع الفردية', 'Projets individualisés'),
  activity: bi('الأنشطة التربوية', 'Activités éducatives'),
  workshop: bi('الورشات', 'Ateliers'),
  intervention: bi('التدخلات', 'Interventions'),
  resource: bi('الموارد المهنية', 'Ressources professionnelles'),
  appointment: bi('المواعيد', 'Rendez-vous'),
  task: bi('المهام', 'Tâches'),
  partner: bi('الهياكل الشريكة', 'Structures partenaires'),
};
export interface SearchResult {
  id: string;
  type: ResourceKind;
  title: Bi;
  excerpt: Bi;
  path: string;
  date?: string;
  caseId?: string;
}
export interface SearchDocument extends SearchResult {
  text: string;
}
export interface SearchResponse {
  intent: Bi | null;
  results: SearchResult[];
}
export interface AuthorizedSearchBackend {
  search(query: string, authorizedDocuments: readonly SearchDocument[]): SearchResult[];
}
export class LocalKeywordSearchBackend implements AuthorizedSearchBackend {
  search(query: string, documents: readonly SearchDocument[]) {
    const q = normalize(query);
    const terms = q.split(' ').filter(Boolean);
    return documents
      .map((document) => {
        const title = normalize(`${document.title.ar} ${document.title.fr}`);
        const content = normalize(document.text);
        const score = terms.every((term) => content.includes(term))
          ? terms.reduce((total, term) => total + (title.includes(term) ? 30 : 2), 0) +
            (normalize(document.id) === q ? 100 : 0) +
            (title.includes(q) ? 40 : 0)
          : 0;
        return { document, score };
      })
      .filter((match) => match.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.document.date ?? '').localeCompare(a.document.date ?? '') ||
          a.document.id.localeCompare(b.document.id),
      )
      .map(({ document }) => ({
        id: document.id,
        type: document.type,
        title: document.title,
        excerpt: document.excerpt,
        path: document.path,
        date: document.date,
        caseId: document.caseId,
      }));
  }
}
const formKind = (id: string): ResourceKind =>
  ['F02', 'F08', 'F12'].includes(id)
    ? 'evaluation'
    : ['F13', 'F14'].includes(id)
      ? 'project'
      : 'document';
const bilingualText = (value: Bi) => `${value.ar} ${value.fr}`;

export interface SearchProvider {
  search(query: string, data: AppData, session: SessionContext, filter?: string): SearchResponse;
}
export class LocalSearchProvider implements SearchProvider {
  constructor(
    private readonly backend: AuthorizedSearchBackend = new LocalKeywordSearchBackend(),
  ) {}
  search(query: string, data: AppData, user: SessionContext, filter = 'all'): SearchResponse {
    const q = normalize(query);
    if (
      !q ||
      !accessPolicyService.isActive(data, user) ||
      !accessPolicyService.hasPermissions(user, ['search.use'])
    )
      return { intent: null, results: [] };
    // Policy evaluation precedes construction of searchable text, previews and counters.
    const scope = accessPolicyService.authorizedData(data, user);
    const caseMatch = q.match(/cdis-\d+/)?.[0].toUpperCase();
    const cases = scope.cases.filter((c) => !caseMatch || c.id === caseMatch);
    const ids = new Set(cases.map((c) => c.id));
    const documents: SearchDocument[] = [];
    const add = (result: SearchResult, extra = '') =>
      documents.push({
        ...result,
        text: `${result.id} ${result.caseId ?? ''} ${bilingualText(result.title)} ${bilingualText(result.excerpt)} ${bilingualText(searchCategories[result.type])} ${extra}`,
      });
    for (const c of cases) {
      const child = scope.children.find((ch) => ch.id === c.childId)!;
      add({
        id: c.id,
        type: 'case',
        title: child.name,
        excerpt: bi(`${c.id} · ${c.source}`, `${c.id} · ${c.source}`),
        path: `/cases/${c.id}`,
        date: c.openedAt,
        caseId: c.id,
      });
      if (
        accessPolicyService.canRead(data, user, { kind: 'project', caseId: c.id }) &&
        (c.goals.length || c.projectNotes)
      ) {
        add(
          {
            id: `project-${c.id}`,
            type: 'project',
            title: bi(
              `المشروع الفردي · ${child.name.ar}`,
              `Projet individualisé · ${child.name.fr}`,
            ),
            excerpt: bi(c.projectNotes, c.projectNotes),
            path: `/cases/${c.id}?tab=project`,
            caseId: c.id,
            date: c.openedAt,
          },
          c.goals.map((g) => bilingualText(g.description)).join(' '),
        );
      }
    }
    for (const form of forms) {
      const c = cases.find((c) =>
        accessPolicyService.canRead(
          data,
          user,
          accessPolicyService.formResource(form.id, c.id, 'form'),
        ),
      );
      if (c)
        add({
          id: form.id,
          type: 'form',
          title: form.title,
          excerpt: bi(`${form.id} · نموذج مهني`, `${form.id} · Modèle métier`),
          path: `/documents/${c.id}/${form.id}`,
        });
    }
    for (const s of scope.submissions.filter((s) => ids.has(s.caseId))) {
      const title = forms.find((f) => f.id === s.formId)?.title ?? bi(s.formId, s.formId);
      const values = Object.values(s.values)
        .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
        .join(' ');
      add(
        {
          id: s.id,
          type: formKind(s.formId),
          title,
          excerpt: bi(
            `${s.caseId} · ${s.formId} · v${s.version}`,
            `${s.caseId} · ${s.formId} · v${s.version}`,
          ),
          path: `/documents/${s.caseId}/${s.formId}?version=${s.id}`,
          date: s.date,
          caseId: s.caseId,
        },
        values,
      );
    }
    for (const e of scope.events.filter((e) => ids.has(e.caseId))) {
      add({
        id: e.id,
        type: accessPolicyService.eventResource(scope, e).kind,
        title: e.title,
        excerpt: bi(e.note, e.note),
        path: `/cases/${e.caseId}?tab=history&event=${e.id}`,
        date: e.date,
        caseId: e.caseId,
      });
    }
    if (!caseMatch) {
      for (const a of scope.activities)
        add(
          {
            id: a.id,
            type: 'activity',
            title: a.title,
            excerpt: a.description,
            path: `/library?activity=${a.id}`,
            date: a.createdAt,
          },
          `${a.skills.join(' ')} ${a.instructions.map(bilingualText).join(' ')}`,
        );
      for (const r of scope.resources)
        add(
          {
            id: r.id,
            type: 'resource',
            title: r.title,
            excerpt: r.description,
            path: `/library?resource=${r.id}`,
            date: r.validatedAt,
          },
          `${r.content.map(bilingualText).join(' ')} ${r.skills.join(' ')}`,
        );
      for (const p of scope.partners)
        add(
          {
            id: p.id,
            type: 'partner',
            title: p.name,
            excerpt: p.description,
            path: `/integration?partner=${p.id}`,
          },
          p.services.map(bilingualText).join(' '),
        );
    }
    for (const s of scope.sessions.filter(
      (s) => !caseMatch || s.participants.some((p) => ids.has(p.caseId)),
    )) {
      const a = scope.activities.find((a) => a.id === s.activityId);
      if (a)
        add(
          {
            id: s.id,
            type: 'workshop',
            title: a.title,
            excerpt: bi(`${s.group} · ${s.date} ${s.time}`, `${s.group} · ${s.date} ${s.time}`),
            path: `/sessions?session=${s.id}`,
            date: s.date,
            caseId: s.participants[0]?.caseId,
          },
          s.participants.map((p) => `${p.caseId} ${p.observations} ${p.progress}`).join(' '),
        );
    }
    for (const a of scope.appointments.filter((a) => !caseMatch || (a.caseId && ids.has(a.caseId))))
      add({
        id: a.id,
        type: 'appointment',
        title: a.title,
        excerpt: bi(a.notes || a.time, a.notes || a.time),
        path: `/calendar?date=${a.date}&appointment=${a.id}`,
        date: a.date,
        caseId: a.caseId,
      });
    for (const t of scope.tasks.filter((t) => !caseMatch || (t.caseId && ids.has(t.caseId))))
      add({
        id: t.id,
        type: 'task',
        title: t.title,
        excerpt: bi(t.dueDate, t.dueDate),
        path: `/tasks?task=${t.id}`,
        date: t.dueDate,
        caseId: t.caseId,
      });
    for (const i of scope.integrations.filter((i) => ids.has(i.caseId)))
      add({
        id: i.id,
        type: 'intervention',
        title: bi(i.partner, i.partner),
        excerpt: bi(`${i.objectives} ${i.notes}`, `${i.objectives} ${i.notes}`),
        path: `/cases/${i.caseId}?tab=integration&integration=${i.id}`,
        date: i.date,
        caseId: i.caseId,
      });

    let intent: Bi | null = null;
    let results: SearchResult[];
    if (/(تقييم اول|evaluation initial)/.test(q)) {
      intent = bi('ملفات دون تقييم أولي مصادق عليه', 'Dossiers sans évaluation initiale validée');
      const initial = cases.filter(
        (c) =>
          accessPolicyService.canRead(data, user, accessPolicyService.formResource('F08', c.id)) &&
          !scope.submissions.some(
            (s) => s.caseId === c.id && s.formId === 'F08' && s.status === 'validated',
          ),
      );
      results = documents.filter(
        (d) => d.type === 'case' && initial.some((c) => c.id === d.caseId),
      );
    } else if (/(تقييم|evaluation)/.test(q) && /(شهر|mois|مبرمج|programm)/.test(q)) {
      intent = bi('تقييمات مبرمجة هذا الشهر', 'Évaluations programmées ce mois');
      results = documents.filter(
        (d) =>
          d.type === 'appointment' &&
          scope.appointments.some(
            (a) =>
              a.id === d.id &&
              a.type === 'evaluation' &&
              !a.completed &&
              a.date.slice(0, 7) === scope.demoDate.slice(0, 7),
          ),
      );
    } else if (/(غير (?:ال)?مكتمل|incomplet)/.test(q) && /(مشروع|مشاريع|projet)/.test(q)) {
      intent = bi('مشاريع تربوية غير مصادق عليها', 'Projets éducatifs non validés');
      results = documents.filter(
        (d) =>
          d.type === 'case' &&
          accessPolicyService.canRead(
            data,
            user,
            accessPolicyService.formResource('F13', d.caseId),
          ) &&
          !scope.submissions.some(
            (s) => s.caseId === d.caseId && s.formId === 'F13' && s.status === 'validated',
          ),
      );
    } else if (
      (/(اسبوع|semaine)/.test(q) && /(نشاط|انشط|activit)/.test(q)) ||
      (/(تدخل|intervention)/.test(q) && /(اخر|dernier)/.test(q))
    ) {
      const weekly = /(اسبوع|semaine)/.test(q);
      const day = new Date(`${scope.demoDate}T12:00:00Z`).getUTCDay();
      const start = addDays(scope.demoDate, -((day + 6) % 7));
      intent = weekly
        ? bi('الأنشطة المنجزة هذا الأسبوع', 'Activités réalisées cette semaine')
        : bi('آخر التدخلات المسجلة', 'Dernières interventions enregistrées');
      results = documents.filter((d) =>
        scope.events.some(
          (e) =>
            e.id === d.id &&
            (weekly
              ? e.type === 'activity' &&
                e.date.slice(0, 10) >= start &&
                e.date.slice(0, 10) <= scope.demoDate
              : ['observation', 'activity'].includes(e.type)),
        ),
      );
    } else {
      results = this.backend.search(query, documents);
    }
    // Strip index-only content from every output, including predefined intents.
    return {
      intent,
      results: results
        .filter((r) => filter === 'all' || r.type === filter)
        .map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          excerpt: r.excerpt,
          path: r.path,
          date: r.date,
          caseId: r.caseId,
        })),
    };
  }
}
export const searchProvider: SearchProvider = new LocalSearchProvider();

export function rememberSearch(data: AppData, user: SessionContext, value: string) {
  if (
    !accessPolicyService.isActive(data, user) ||
    !accessPolicyService.hasPermissions(user, ['search.use'])
  )
    throw Error('ACCESS');
  const query = value.trim().slice(0, 300);
  if (!query) return;
  const key = accessPolicyService.contextKey(data, user);
  data.searchHistories[key] = [
    query,
    ...(data.searchHistories[key] ?? []).filter((q) => q !== query),
  ].slice(0, 12);
}
