import { useEffect, useState } from 'react';
import { useWorkspace } from './useWorkspace';
import { accessPolicyService } from '../services/accessPolicy';
import { api } from '../services/api';
import type { SearchResponse } from '../services/search';

const empty: SearchResponse = { intent: null, results: [] };
export const searchDebounceMs = 300;
export function useIntelligentSearch(query: string, filter = 'all') {
  const { data, session, revision } = useWorkspace();
  const scopeKey = accessPolicyService.contextKey(data, session);
  const key = JSON.stringify([scopeKey, revision, query, filter]);
  const [completed, setCompleted] = useState<{ key: string; response: SearchResponse } | null>(
    null,
  );
  useEffect(() => {
    setCompleted(null);
    if (!session || !query.trim()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void api<SearchResponse>(
        '/search',
        { q: query, category: filter },
        { signal: controller.signal },
      )
        .then((response) => setCompleted({ key, response }))
        .catch(() => {
          if (!controller.signal.aborted) setCompleted({ key, response: empty });
        });
    }, searchDebounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, filter, key, data, session]);
  // Never render an earlier query, access context or revision, even for one frame.
  return {
    ...(completed?.key === key ? completed.response : empty),
    pending: Boolean(query.trim() && completed?.key !== key),
    scopeKey,
  };
}
