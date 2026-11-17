import { useEffect, useState } from 'react';
import { api } from '../../services/api';

export function useEntryResource<T>(path: string | null) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{
    path: string;
    revision: number;
    data?: T;
    error?: boolean;
  }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void api<T>(path, undefined, { signal: controller.signal })
      .then((data) => setResult({ path, revision, data }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ path, revision, error: true });
      });
    return () => controller.abort();
  }, [path, revision]);
  const current = result?.path === path && result?.revision === revision ? result : undefined;
  return {
    data: current?.data,
    error: !!current?.error,
    loading: !!path && !current,
    retry: () => setRevision((v) => v + 1),
  };
}
