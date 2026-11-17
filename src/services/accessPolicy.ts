import type {
  AppData,
  AttributeCondition,
  Case,
  JourneyEvent,
  Permission,
  Recommendation,
  ResourceKind,
  ResourcePolicy,
  SessionContext,
} from '../types';
import { getForm } from '../data/form-definitions';
import { accessPolicyVersion } from '../config/access';

export interface AccessResource extends ResourcePolicy {
  formId?: string;
  kind: ResourceKind;
  caseId?: string;
  caseIds?: string[];
  ownerId?: string;
}
const stableAttributes = (attributes: SessionContext['attributes']) =>
  Object.fromEntries(
    Object.entries(attributes)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]),
  );

/** Frontend demonstration only. A server must enforce this BEFORE retrieving real records. */
export class AccessPolicyService {
  isActive(data: AppData, user: SessionContext | null): user is SessionContext {
    return Boolean(
      user &&
      user.simulation &&
      user.attributes.active === true &&
      user.userId === user.professionalId &&
      user.cdisId === user.centerId &&
      user.professionalRole === user.role &&
      data.professionals.some(
        (p) =>
          p.id === user.userId && p.role === user.professionalRole && p.centerId === user.cdisId,
      ),
    );
  }
  hasPermissions(user: SessionContext, permissions: Permission[]) {
    return permissions.every((permission) => user.permissions.includes(permission));
  }
  matchesAttributes(user: SessionContext, conditions: AttributeCondition[]) {
    return conditions.every(({ attribute, equals }) => user.attributes[attribute] === equals);
  }
  private matchesPolicy(user: SessionContext, policy: ResourcePolicy) {
    return (
      (!policy.cdisId || policy.cdisId === user.cdisId) &&
      (!policy.allowedRoles || policy.allowedRoles.includes(user.professionalRole)) &&
      this.hasPermissions(user, policy.requiredPermissions ?? []) &&
      this.matchesAttributes(user, policy.attributeConditions ?? []) &&
      (policy.sensitivity !== 'psychological' ||
        (this.hasPermissions(user, ['psychology.read']) &&
          user.attributes.psychologyAuthorized === true))
    );
  }
  private caseAllowed(data: AppData, user: SessionContext, c: Case) {
    if (
      !this.hasPermissions(user, ['case.read']) ||
      c.centerId !== user.cdisId ||
      !this.matchesPolicy(user, c.access ?? {}) ||
      user.attributes.caseAccess === false
    )
      return false;
    if (
      Array.isArray(user.attributes.allowedStages) &&
      !user.attributes.allowedStages.includes(String(c.stage))
    )
      return false;
    const assigned =
      user.assignedCaseIds.includes(c.id) &&
      data.assignments.some((a) => a.caseId === c.id && a.professionalId === user.userId);
    const centerScope =
      user.professionalRole === 'administration' &&
      user.attributes.caseScope === 'center' &&
      this.hasPermissions(user, ['case.read.center']);
    return centerScope || (user.attributes.caseScope === 'assigned' && assigned);
  }
  canRead(data: AppData, user: SessionContext | null, resource: AccessResource): boolean {
    if (user?.authority === 'server' && data.backend) {
      const ids = [...(resource.caseIds ?? []), ...(resource.caseId ? [resource.caseId] : [])];
      if (resource.formId && resource.caseId) return Boolean(data.backend.access[resource.caseId]?.forms[resource.formId]);
      return ids.every((id) => data.cases.some((c) => c.id === id));
    }
    if (
      !this.isActive(data, user) ||
      !this.hasPermissions(user, [`${resource.kind}.read`]) ||
      !this.matchesPolicy(user, resource)
    )
      return false;
    const ids = [...(resource.caseIds ?? []), ...(resource.caseId ? [resource.caseId] : [])];
    if (resource.kind === 'case' && !ids.length) return false;
    if (ids.length)
      return ids.every((id) => {
        const c = data.cases.find((c) => c.id === id);
        return c && this.caseAllowed(data, user, c);
      });
    return !resource.ownerId || resource.ownerId === user.userId;
  }
  authorizedCases(data: AppData, user: SessionContext | null): Case[] {
    return data.cases.filter((c) => this.canRead(data, user, { kind: 'case', caseId: c.id }));
  }
  formResource(formId: string, caseId?: string, kind: ResourceKind = 'document'): AccessResource {
    return {
      formId,
      kind,
      caseId,
      sensitivity: getForm(formId)?.role === 'psychologist' ? 'psychological' : 'team',
      requiredPermissions: ['F02', 'F08', 'F12'].includes(formId)
        ? ['evaluation.read']
        : ['F13', 'F14'].includes(formId)
          ? ['project.read']
          : [],
    };
  }
  recommendationResource(data: AppData, rec: Recommendation): AccessResource {
    const activity = data.activities.find((a) => a.id === rec.activityId);
    const resource = data.resources.find((r) => r.id === rec.resourceId);
    return {
      kind: rec.activityId
        ? 'workshop'
        : rec.resourceId
          ? 'resource'
          : (rec.sources?.[0]?.kind ?? 'intervention'),
      caseId: rec.caseId,
      caseIds: rec.targetCaseIds,
      ...(resource?.access ?? activity?.access),
      requiredPermissions: [
        ...(resource?.access?.requiredPermissions ?? activity?.access?.requiredPermissions ?? []),
        ...(rec.activityId ? ['activity.read' as const] : []),
      ],
    };
  }
  eventResource(data: AppData, event: JourneyEvent): AccessResource {
    const submission = data.submissions.find((s) => s.id === event.sourceId);
    const psychAuthor = data.professionals.some(
      (p) => p.id === event.professionalId && p.role === 'psychologist',
    );
    const rec = data.recommendations.find((r) => r.id === event.sourceId);
    if (event.type === 'recommendation' && rec) {
      return { ...this.recommendationResource(data, rec), caseId: event.caseId };
    }
    const workshop = data.sessions.find((s) => s.id === event.sourceId);
    const activity = data.activities.find((a) => a.id === workshop?.activityId);
    const sourceForm = submission ? this.formResource(submission.formId) : undefined;
    return {
      kind:
        event.type === 'assessment'
          ? 'evaluation'
          : event.type === 'observation'
            ? 'observation'
            : 'intervention',
      caseId: event.caseId,
      caseIds: workshop?.participants.map((p) => p.caseId),
      ...activity?.access,
      requiredPermissions: [
        ...(sourceForm
          ? ['document.read' as const, ...(sourceForm.requiredPermissions ?? [])]
          : []),
        ...(workshop
          ? [
              'workshop.read' as const,
              'activity.read' as const,
              ...(activity?.access?.requiredPermissions ?? []),
            ]
          : []),
      ],
      sensitivity: sourceForm
        ? sourceForm.sensitivity
        : activity?.access?.sensitivity
          ? activity.access.sensitivity
          : psychAuthor && ['observation', 'assessment'].includes(event.type)
            ? 'psychological'
            : 'team',
    };
  }
  contextKey(data: AppData, user: SessionContext | null): string {
    if (user?.authority === 'server') return `${user.sessionId}:${data.backend?.fingerprint ?? 'empty'}`;
    if (!this.isActive(data, user)) return 'anonymous';
    return JSON.stringify([
      accessPolicyVersion,
      user.userId,
      user.professionalRole,
      user.cdisId,
      [...user.assignedCaseIds].sort(),
      [...user.permissions].sort(),
      stableAttributes(user.attributes),
      this.authorizedCases(data, user)
        .map((c) => c.id)
        .sort(),
    ]);
  }
  /** Projection shared by retrieval and existing modules. No denied record enters the index. */
  authorizedData(data: AppData, user: SessionContext | null): AppData {
    if (user?.authority === 'server' && data.backend) return data;
    const cases = this.authorizedCases(data, user);
    const ids = new Set(cases.map((c) => c.id));
    const children = data.children.filter((ch) => cases.some((c) => c.childId === ch.id));
    const allowed = (resource: AccessResource) => this.canRead(data, user, resource);
    const key = this.contextKey(data, user);
    return {
      ...data,
      cases: cases.map((c) =>
        allowed({ kind: 'project', caseId: c.id }) ? c : { ...c, goals: [], projectNotes: '' },
      ),
      children,
      families: data.families.filter((f) => children.some((ch) => ch.familyId === f.id)),
      submissions: data.submissions.filter((s) => allowed(this.formResource(s.formId, s.caseId))),
      events: data.events.filter((e) => allowed(this.eventResource(data, e))),
      activities: data.activities.filter((a) => allowed({ kind: 'activity', ...a.access })),
      resources: data.resources.filter((r) => allowed({ kind: 'resource', ...r.access })),
      partners: data.partners.filter((p) => allowed({ kind: 'partner', ...p.access })),
      sessions: data.sessions.filter(
        (s) =>
          s.participants.length > 0 &&
          allowed({ kind: 'workshop', caseIds: s.participants.map((p) => p.caseId) }) &&
          data.activities.some(
            (a) => a.id === s.activityId && allowed({ kind: 'activity', ...a.access }),
          ),
      ),
      appointments: data.appointments.filter((a) =>
        allowed({
          kind: 'appointment',
          caseId: a.caseId,
          ownerId: a.professionalId,
          requiredPermissions: a.type === 'evaluation' ? ['evaluation.read'] : [],
        }),
      ),
      tasks: data.tasks.filter((t) =>
        allowed({ kind: 'task', caseId: t.caseId, ownerId: t.professionalId }),
      ),
      integrations: data.integrations.filter((i) =>
        allowed({ kind: 'intervention', caseId: i.caseId }),
      ),
      transfers: data.transfers.filter((t) => ids.has(t.caseId)),
      recommendations: data.recommendations.filter(
        (r) =>
          (!r.generatedFor || r.generatedFor === key) &&
          allowed(this.recommendationResource(data, r)),
      ),
      conversations: data.conversations.filter((c) => user && c.members.includes(user.userId)),
      // Legacy shared queries are deliberately never exposed to another profile.
      searchHistory: [],
      searchHistories: user ? { [key]: data.searchHistories[key] ?? [] } : {},
    };
  }
}
export const accessPolicyService = new AccessPolicyService();
