import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAppStore } from '../../stores/app';

/** A disposable API projection. A scope/session change immediately hides old data. */
export function useJourneyResource<T>(path: string | null) {
  const { session, revision, data } = useAppStore();
  const key = `${session?.sessionId}:${data.backend?.fingerprint}:${path}`;
  const [result, setResult] = useState<{ key: string; data: T | null; error: boolean }>();
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    if (!path || !session) return;
    let controller: AbortController | undefined;
    let stopped = false;
    let pending = false;
    const load = async () => {
      if (pending || stopped) return;
      pending = true;
      controller = new AbortController();
      try {
        const value = await api<T>(path, undefined, { signal: controller.signal });
        if (!stopped) setResult({ key, data: value, error: false });
      } catch {
        if (!stopped) setResult({ key, data: null, error: true });
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 5000);
    const focus = () => void load();
    window.addEventListener('focus', focus);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [path, key, revision, retryCount, session]);
  return {
    data: path && result?.key === key ? result.data : null,
    error: Boolean(path && result?.key === key && result.error),
    retry: () => setRetryCount((v) => v + 1),
  };
}
