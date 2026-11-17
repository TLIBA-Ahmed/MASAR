import type { AppData } from '../types';
export function aggregateNational(
  data: AppData,
  filter: { centerId?: string; region?: string; from?: string } = {},
) {
  const centers = data.centers.filter(
    (c) =>
      (!filter.centerId || c.id === filter.centerId) &&
      (!filter.region || c.region.fr === filter.region),
  );
  const centerIds = new Set(centers.map((c) => c.id));
  const cases = data.cases.filter(
    (c) => centerIds.has(c.centerId) && (!filter.from || c.openedAt >= filter.from),
  );
  const ids = new Set(cases.map((c) => c.id));
  return {
    total: cases.length,
    active: cases.filter((c) => c.status === 'active').length,
    closed: cases.filter((c) => c.status === 'closed').length,
    centers: centers.map((center) => ({
      id: center.id,
      name: center.name,
      region: center.region,
      total: cases.filter((c) => c.centerId === center.id).length,
      stages: [1, 2, 3, 4, 5].map(
        (stage) => cases.filter((c) => c.centerId === center.id && c.stage === stage).length,
      ),
    })),
    stages: [1, 2, 3, 4, 5].map((stage) => cases.filter((c) => c.stage === stage).length),
    sessions: data.sessions.filter(
      (s) => s.status === 'completed' && s.participants.some((p) => ids.has(p.caseId)),
    ).length,
    interventions: data.events.filter((e) => ids.has(e.caseId) && e.type === 'observation').length,
    evaluations: data.submissions.filter(
      (s) =>
        ids.has(s.caseId) && ['F08', 'F12', 'F09'].includes(s.formId) && s.status === 'validated',
    ).length,
    integrations: data.integrations.filter((i) => ids.has(i.caseId)).length,
    goals: Object.entries(
      cases
        .flatMap((c) => c.goals.filter((g) => g.confirmed))
        .reduce<Record<string, number>>(
          (acc, g) => ({ ...acc, [g.skill]: (acc[g.skill] ?? 0) + 1 }),
          {},
        ),
    )
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count),
  };
}
