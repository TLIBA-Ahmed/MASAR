import { useAppStore } from '../stores/app';
import { useMemo } from 'react';
import { accessPolicyService } from '../services/accessPolicy';
export function useWorkspace() {
  const store = useAppStore();
  const data = useMemo(
    () => accessPolicyService.authorizedData(store.data, store.session),
    [store.data, store.session],
  );
  const cases = data.cases;
  return {
    ...store,
    data,
    cases,
    child: (caseId: string) => {
      const c = cases.find((c) => c.id === caseId);
      return c ? store.data.children.find((ch) => ch.id === c.childId) : undefined;
    },
  };
}
