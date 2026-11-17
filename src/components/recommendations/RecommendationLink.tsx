import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspace } from '../../hooks/useWorkspace';
import { centralRecommendationEngine } from '../../services/recommendations';

export function RecommendationLink({
  contexts,
  caseId,
  activityId,
  workshopId,
  children,
  className = 'button primary',
}: {
  contexts: string[];
  caseId?: string;
  activityId?: string;
  workshopId?: string;
  children: ReactNode;
  className?: string;
}) {
  const { data, session } = useWorkspace();
  const available = centralRecommendationEngine.availableContexts(data, session,caseId);
  const contextId = contexts.find((id) => available.some((c) => c.contextId === id)) ?? '';
  const params = new URLSearchParams({ context: contextId });
  if (caseId) params.set('case', caseId);
  if (activityId) params.set('activity', activityId);
  if (workshopId && contextId === 'workshops') params.set('workshop', workshopId);
  return (
    <Link to={`/recommendations?${params.toString()}`} className={className}>
      {children}
    </Link>
  );
}
