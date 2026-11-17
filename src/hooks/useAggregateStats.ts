import { useAppStore } from '../stores/app';
import { aggregateNational } from '../services/analytics';
import { accessPolicyService } from '../services/accessPolicy';

/** Only anonymized aggregates leave this hook; individual records stay in retrieval services. */
export function useAggregateStats(filters: Parameters<typeof aggregateNational>[1]) {
  const { data, session } = useAppStore();
  const nationalAllowed =
    accessPolicyService.isActive(data, session) &&
    accessPolicyService.hasPermissions(session, ['aggregate.read']) &&
    session.attributes.nationalAggregates !== false;
  return aggregateNational(
    nationalAllowed ? data : accessPolicyService.authorizedData(data, session),
    filters,
  );
}
