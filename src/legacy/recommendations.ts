// Historical deterministic reference for regression tests; never a runtime server authority.
import { bi } from '../types';
import type {
  ActivityTemplate,
  AppData,
  Case,
  EducationalGoal,
  ProfessionalResource,
  Recommendation,
  RecommendationConstraints,
  RecommendationContext,
  RecommendationInput,
  SessionContext,
} from '../types';
import { ageAt } from '../utils/date';
import { materialLabels } from '../config/workflow';
import { accessPolicyService } from '../services/accessPolicy';
import {
  RecommendationContextRegistry,
  recommendationContextRegistry,
} from '../services/recommendationContextRegistry';

type Target = Pick<Case, 'id' | 'stage' | 'status'> & { age: number; goals: EducationalGoal[] };
interface AuthorizedRecommendationData {
  targets: Target[];
  activities: ActivityTemplate[];
  resources: ProfessionalResource[];
  completed: { activityId: string; caseIds: string[] }[];
  project?: { id: string; caseId: string; formId: string; version: number };
  documents: Pick<
    AppData['submissions'][number],
    'id' | 'caseId' | 'formId' | 'version' | 'status'
  >[];
  tasks: AppData['tasks'];
  appointments: Omit<AppData['appointments'][number], 'notes'>[];
  partners: AppData['partners'];
  demoDate: string;
}
const defaults: RecommendationConstraints = {
  maxDuration: 60,
  format: 'any',
  materials: Object.keys(materialLabels),
  participants: 3,
};
const hash = (value: string) => {
  let number = 2166136261;
  for (let i = 0; i < value.length; i++) number = Math.imul(number ^ value.charCodeAt(i), 16777619);
  return (number >>> 0).toString(36);
};
const confirmed = (goal: EducationalGoal, data: AppData) =>
  Boolean(
    goal.confirmed &&
    goal.confirmedBy &&
    goal.confirmedAt &&
    data.professionals.some((p) => p.id === goal.confirmedBy),
  );

/** The only recommendation entry point. Strategies receive a minimal authorized projection. */
export class CentralRecommendationEngine {
  constructor(
    private readonly registry: RecommendationContextRegistry = recommendationContextRegistry,
  ) {}
  availableContexts(data: AppData, user: SessionContext | null) {
    return this.registry.available(data, user);
  }

  private retrieve(
    data: AppData,
    user: SessionContext,
    context: RecommendationContext,
    input: RecommendationInput,
  ): AuthorizedRecommendationData {
    const scope = accessPolicyService.authorizedData(data, user);
    const sources = new Set(context.authorizedDataSources);
    const allowedInputs = [...context.requiredInputs, ...context.optionalInputs];
    for (const key of context.requiredInputs) {
      if (
        ['projectId', 'groupId', 'workshopId'].includes(key) &&
        !input[key as 'projectId' | 'groupId' | 'workshopId']
      )
        throw Error('VALIDATION');
    }
    for (const key of ['projectId', 'groupId', 'workshopId'] as const) {
      if (input[key] && !allowedInputs.includes(key)) throw Error('VALIDATION');
    }
    let caseIds = input.caseId ? [input.caseId] : [];
    if ((input.groupId || input.workshopId) && !sources.has('workshop')) throw Error('ACCESS');
    if (input.workshopId) {
      const workshop = scope.sessions.find((s) => s.id === input.workshopId);
      if (!workshop) throw Error('ACCESS');
      caseIds = workshop.participants.map((p) => p.caseId);
    } else if (input.groupId) {
      const sessions = scope.sessions.filter(
        (s) => s.group === input.groupId && ['planned', 'inProgress'].includes(s.status),
      );
      if (!sessions.length) throw Error('ACCESS');
      caseIds = sessions.flatMap((s) => s.participants.map((p) => p.caseId));
    }
    caseIds = [...new Set(caseIds)].sort();
    if (caseIds.length && !sources.has('case')) throw Error('ACCESS');
    if (
      (context.requiredInputs.includes('caseId') ||
        allowedInputs.includes('groupId') ||
        allowedInputs.includes('workshopId')) &&
      !caseIds.length
    )
      throw Error('VALIDATION');
    const targets = caseIds.map((id): Target => {
      const c = scope.cases.find((c) => c.id === id);
      if (!c) throw Error('ACCESS');
      if (c.status !== 'active') throw Error('INACTIVE');
      const child = scope.children.find((ch) => ch.id === c.childId)!;
      return {
        id: c.id,
        stage: c.stage,
        status: c.status,
        age: ageAt(child.birthDate, data.demoDate),
        goals: c.goals.filter(
          (g) => confirmed(g, scope) && (!input.goalIds || input.goalIds.includes(g.id)),
        ),
      };
    });
    if (input.goalIds?.some((id) => !targets.some((t) => t.goals.some((g) => g.id === id))))
      throw Error('GOALS');
    let project: AuthorizedRecommendationData['project'];
    if (input.projectId) {
      const selected = scope.submissions.find(
        (s) =>
          s.id === input.projectId &&
          caseIds.includes(s.caseId) &&
          s.formId === (context.recommendationStrategy === 'training' ? 'F14' : 'F13'),
      );
      if (!selected || !sources.has('project')) throw Error('ACCESS');
      project = {
        id: selected.id,
        formId: selected.formId,
        caseId: selected.caseId,
        version: selected.version,
      };
    }
    return {
      targets,
      project,
      demoDate: scope.demoDate,
      documents: sources.has('document')
        ? scope.submissions
            .filter((s) => caseIds.includes(s.caseId))
            .map((s) => ({
              id: s.id,
              caseId: s.caseId,
              formId: s.formId,
              version: s.version,
              status: s.status,
            }))
        : [],
      activities: sources.has('activity') ? scope.activities : [],
      resources: sources.has('resource')
        ? scope.resources.filter(
            (r) =>
              r.validatedBy &&
              r.validatedAt &&
              scope.professionals.some((p) => p.id === r.validatedBy),
          )
        : [],
      completed: sources.has('workshop')
        ? scope.sessions
            .filter(
              (s) =>
                s.status === 'completed' && s.participants.some((p) => caseIds.includes(p.caseId)),
            )
            .map((s) => ({
              activityId: s.activityId,
              caseIds: s.participants.map((p) => p.caseId),
            }))
        : [],
      tasks: sources.has('task')
        ? scope.tasks.filter(
            (t) => !t.completed && (!caseIds.length || (t.caseId && caseIds.includes(t.caseId))),
          )
        : [],
      appointments: sources.has('appointment')
        ? scope.appointments
            .filter(
              (a) => !a.completed && (!caseIds.length || (a.caseId && caseIds.includes(a.caseId))),
            )
            .map((a) => ({
              id: a.id,
              title: a.title,
              type: a.type,
              date: a.date,
              time: a.time,
              caseId: a.caseId,
              professionalId: a.professionalId,
              completed: a.completed,
            }))
        : [],
      partners: sources.has('partner') ? scope.partners : [],
    };
  }

  generate(
    data: AppData,
    user: SessionContext,
    contextId: string,
    input: RecommendationInput,
  ): Recommendation[] {
    const context = this.registry.require(data, user, contextId);
    const authorized = this.retrieve(data, user, context, input);
    const { targets } = authorized;
    if (context.requiredInputs.includes('goalIds') && targets.some((t) => !t.goals.length))
      return [];
    const scopeKey = accessPolicyService.contextKey(data, user);
    const normalizedInput = structuredClone(input);
    const base = (id: string, caseId = targets[0]?.id ?? ''): Recommendation => ({
      id: `rec-${contextId}-${hash(JSON.stringify([scopeKey, normalizedInput]))}-${caseId}-${id}`,
      contextId,
      caseId,
      activityId: '',
      goalIds: [],
      score: 0,
      reasons: [],
      sources: [],
      status: 'suggested',
      date: authorized.demoDate,
      targetCaseIds: caseId ? (targets.length ? targets.map((t) => t.id) : [caseId]) : [],
      generatedFor: scopeKey,
      inputs: normalizedInput,
      projectId: authorized.project?.id,
    });
    const goalSources = (goals: EducationalGoal[]) =>
      goals.map((goal) => ({
        id: goal.id,
        kind: 'project' as const,
        label: goal.description,
        path: `/cases/${targets.find((t) => t.goals.some((g) => g.id === goal.id))!.id}?tab=project`,
      }));
    const projectSources = authorized.project
      ? [
          {
            id: authorized.project.id,
            kind: 'project' as const,
            label: bi(
              `مشروع ${authorized.project.formId} · v${authorized.project.version}`,
              `Projet ${authorized.project.formId} · v${authorized.project.version}`,
            ),
            path: `/documents/${authorized.project.caseId}/${authorized.project.formId}?version=${authorized.project.id}`,
          },
        ]
      : [];
    const allGoals = targets.flatMap((t) => t.goals);
    const documentSources = authorized.documents.map((s) => ({
      id: s.id,
      kind: 'document' as const,
      label: bi(`وثيقة ${s.formId} · v${s.version}`, `Document ${s.formId} · v${s.version}`),
      path: `/documents/${s.caseId}/${s.formId}?version=${s.id}`,
    }));
    const results: Recommendation[] = [];
    const activityStrategy = ['activities', 'project', 'support'].includes(
      context.recommendationStrategy,
    );
    if (activityStrategy) {
      const constraints = { ...defaults, ...input.constraints };
      if (
        !Number.isFinite(constraints.maxDuration) ||
        constraints.maxDuration < 1 ||
        !Number.isInteger(constraints.participants) ||
        constraints.participants < 1 ||
        constraints.participants > 20 ||
        !['any', 'individual', 'group'].includes(constraints.format)
      )
        throw Error('VALIDATION');
      for (const activity of authorized.activities) {
        if (input.activityId && activity.id !== input.activityId) continue;
        if (
          context.recommendationStrategy === 'support' &&
          (!activity.professionalValidation ||
            !data.professionals.some(
              (p) => p.id === activity.professionalValidation?.professionalId,
            ))
        )
          continue;
        const participants =
          input.groupId || input.workshopId
            ? targets.length
            : activity.format === 'individual' && constraints.format === 'any'
              ? 1
              : constraints.format === 'individual'
                ? 1
                : constraints.participants;
        if (
          !targets.every((t) => t.age >= activity.minAge && t.age <= activity.maxAge) ||
          activity.duration > constraints.maxDuration ||
          (constraints.format !== 'any' && constraints.format !== activity.format) ||
          participants < activity.minParticipants ||
          participants > activity.maxParticipants ||
          !activity.materials.every((m) => m === 'none' || constraints.materials.includes(m)) ||
          (input.skills?.length && !input.skills.some((s) => activity.skills.includes(s)))
        )
          continue;
        const matched = allGoals.filter((g) => activity.skills.includes(g.skill));
        if (!targets.every((t) => matched.some((g) => t.goals.some((tg) => tg.id === g.id))))
          continue;
        const done = authorized.completed.filter((s) => s.activityId === activity.id).length;
        const primaryGoals = matched.filter((g) => targets[0].goals.some((t) => t.id === g.id));
        results.push({
          ...base(activity.id),
          kind: 'activity',
          activityId: activity.id,
          title: activity.title,
          summary: activity.description,
          goalIds: primaryGoals.map((g) => g.id),
          targetGoalIds: Object.fromEntries(
            targets.map((t) => [
              t.id,
              matched.filter((g) => t.goals.some((goal) => goal.id === g.id)).map((g) => g.id),
            ]),
          ),
          score: Math.max(0, Math.round((matched.length / allGoals.length) * 100) - done * 10),
          reasons: [
            ...matched.map((g) =>
              bi(
                `يساهم في الهدف المهني المؤكد: ${g.description.ar}`,
                `Contribue à l’objectif confirmé : ${g.description.fr}`,
              ),
            ),
            bi(
              `المدة ${activity.duration} دقيقة والمعدات متاحة وفق الشروط.`,
              `Durée de ${activity.duration} min et matériel compatible avec les conditions.`,
            ),
            ...(done
              ? [
                  bi(
                    `أُنجز النشاط ${done} مرة؛ راجع ملاءمة تكراره.`,
                    `Activité déjà réalisée ${done} fois ; examiner l’intérêt d’une répétition.`,
                  ),
                ]
              : []),
            ...(context.recommendationStrategy === 'support'
              ? [
                  bi(
                    'نشاط بمراجعة مهنية تجريبية سابقة.',
                    'Activité avec validation professionnelle préalable simulée.',
                  ),
                ]
              : []),
          ],
          sources: [
            {
              id: activity.id,
              kind: 'activity',
              label: activity.source,
              path: `/library?activity=${activity.id}`,
            },
            ...goalSources(matched),
            ...projectSources,
          ],
          program:
            context.recommendationStrategy === 'project'
              ? [
                  bi(
                    'مراجعة الهدف مع المربي قبل الحصة.',
                    'Revoir l’objectif avec l’éducateur avant la séance.',
                  ),
                  ...activity.instructions,
                  bi(
                    'توثيق المشاركة ومراجعة الملاءمة مع المهني.',
                    'Documenter la participation et réexaminer la pertinence avec le professionnel.',
                  ),
                ]
              : undefined,
        });
      }
    }
    const domains: Record<string, string[]> = {
      project: ['education'],
      training: ['training'],
      social: ['social'],
      family: ['family'],
      orientation: ['orientation'],
      resources:
        user.professionalRole === 'psychologist' ? ['psychology', 'support'] : ['education'],
      documents: ['administration'],
      coordination:
        user.professionalRole === 'administration'
          ? ['administration']
          : ['coordination', 'social'],
    };
    for (const resource of authorized.resources) {
      if (!resource.domains.some((d) => domains[context.recommendationStrategy]?.includes(d)))
        continue;
      const matched = allGoals.filter((g) => resource.skills.includes(g.skill));
      const administrative = user.professionalRole === 'administration';
      if (
        !administrative &&
        (!matched.length || !targets.every((t) => t.goals.some((g) => matched.includes(g))))
      )
        continue;
      results.push({
        ...base(resource.id),
        kind: context.recommendationStrategy === 'training' ? 'program' : 'resource',
        resourceId: resource.id,
        title: resource.title,
        summary: resource.description,
        goalIds: matched.filter((g) => targets[0]?.goals.includes(g)).map((g) => g.id),
        score: administrative ? 0 : Math.round((matched.length / allGoals.length) * 100),
        reasons: administrative
          ? [
              bi(
                'قائمة مراجعة متاحة في الموارد المهنية المراجعة.',
                'Checklist disponible dans les ressources professionnelles revues.',
              ),
              ...(authorized.documents.length
                ? [
                    bi(
                      `تتوفر ${authorized.documents.length} نسخ وثائق مصرح بها للمراجعة.`,
                      `${authorized.documents.length} versions documentaires autorisées sont disponibles pour la revue.`,
                    ),
                  ]
                : []),
            ]
          : matched.map((g) =>
              bi(
                `مرتبط بالهدف المؤكد: ${g.description.ar}`,
                `Liée à l’objectif confirmé : ${g.description.fr}`,
              ),
            ),
        sources: [
          {
            id: resource.id,
            kind: 'resource',
            label: resource.source,
            path: `/library?resource=${resource.id}`,
          },
          ...goalSources(matched),
          ...projectSources,
          ...documentSources,
          ...authorized.partners.map((p) => ({
            id: p.id,
            kind: 'partner' as const,
            label: p.name,
            path: `/integration?partner=${p.id}`,
          })),
        ],
        program: resource.content,
      });
    }
    for (const task of authorized.tasks) {
      results.push({
        ...base(task.id, task.caseId ?? ''),
        kind: 'followUp',
        title: task.title,
        summary: bi(
          `موعد مراجعة المهمة: ${task.dueDate}`,
          `Échéance de la tâche : ${task.dueDate}`,
        ),
        goalIds: allGoals.map((g) => g.id),
        reasons: [
          bi(
            'مهمة غير مكتملة مسجلة، تُعرض للمراجعة البشرية.',
            'Tâche existante non terminée, proposée à la revue humaine.',
          ),
        ],
        sources: [{ id: task.id, kind: 'task', label: task.title, path: `/tasks?task=${task.id}` }],
      });
    }
    for (const appointment of authorized.appointments) {
      results.push({
        ...base(appointment.id, appointment.caseId ?? ''),
        kind: 'followUp',
        title: appointment.title,
        summary: bi(
          `موعد مسجل: ${appointment.date} · ${appointment.time}`,
          `Rendez-vous enregistré : ${appointment.date} · ${appointment.time}`,
        ),
        goalIds: allGoals.map((g) => g.id),
        reasons: [
          bi(
            'الموعد مسجل ولم يُنجز بعد؛ يلزم تأكيد المهني.',
            'Rendez-vous existant non réalisé ; confirmation professionnelle requise.',
          ),
        ],
        sources: [
          {
            id: appointment.id,
            kind: 'appointment',
            label: appointment.title,
            path: `/calendar?date=${appointment.date}&appointment=${appointment.id}`,
          },
        ],
      });
    }
    return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  }

  validateProposal(data: AppData, user: SessionContext, proposal: Recommendation): Recommendation {
    if (
      !proposal.contextId ||
      !proposal.inputs ||
      proposal.generatedFor !== accessPolicyService.contextKey(data, user) ||
      !accessPolicyService.hasPermissions(user, ['recommendation.validate'])
    )
      throw Error('ACCESS');
    const expected = this.generate(data, user, proposal.contextId, proposal.inputs).find(
      (r) => r.id === proposal.id,
    );
    if (!expected || JSON.stringify(expected) !== JSON.stringify(proposal))
      throw Error('STALE_RECOMMENDATION');
    return expected;
  }
}
export const centralRecommendationEngine = new CentralRecommendationEngine();
