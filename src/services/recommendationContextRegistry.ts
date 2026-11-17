import type { AppData, RecommendationContext, SessionContext } from '../types';
import { defaultRecommendationContexts } from '../config/recommendationContexts';
import { accessPolicyService } from './accessPolicy';

export class RecommendationContextRegistry {
  constructor(
    private readonly contexts: readonly RecommendationContext[] = defaultRecommendationContexts,
  ) {}
  get(contextId: string) {
    return this.contexts.find((c) => c.contextId === contextId);
  }
  available(data: AppData, user: SessionContext | null): RecommendationContext[] {
    if(user?.authority==='server'&&data.backend)return [...new Map(Object.values(data.backend.templates).flat().map(c=>[c.contextId,c])).values()];
    if (!accessPolicyService.isActive(data, user)) return [];
    return this.contexts.filter(
      (context) =>
        context.allowedRoles.includes(user.professionalRole) &&
        accessPolicyService.hasPermissions(user, context.requiredPermissions) &&
        accessPolicyService.matchesAttributes(user, context.attributeConditions),
    );
  }
  require(data: AppData, user: SessionContext, contextId: string) {
    const context = this.available(data, user).find((c) => c.contextId === contextId);
    if (!context) throw Error('ACCESS');
    return context;
  }
}
export const recommendationContextRegistry = new RecommendationContextRegistry();
