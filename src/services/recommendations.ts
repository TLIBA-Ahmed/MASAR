/** Thin frontend client for the single authoritative backend recommendation engine. */
import { api } from './api';
import type { AppData, SessionContext, Recommendation } from '../types';
export interface GeneratedRecommendations {
  status: string;
  recommendations: Recommendation[];
  limitations: string[];
  mode?: string;
}
class CentralRecommendationClient {
  availableContexts(data: AppData, user: SessionContext | null, caseId?: string) {
    if (user?.authority !== 'server' || !data.backend) return [];
    return caseId
      ? (data.backend.templates[caseId] ?? [])
      : [
          ...new Map(
            Object.values(data.backend.templates)
              .flat()
              .map((c) => [c.contextId, c]),
          ).values(),
        ];
  }
  generate(input: unknown, signal?: AbortSignal) {
    return api<GeneratedRecommendations>('/recommendations/generate', input, { signal });
  }
  feedback(id: string, status: 'ACCEPTED' | 'MODIFIED' | 'REJECTED' | 'DEFERRED', reason: string) {
    return api(`/recommendations/${id}/feedback`, { status, reason });
  }
}
export const centralRecommendationEngine = new CentralRecommendationClient();
