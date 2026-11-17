import { create } from 'zustand';
import type { AppData, SessionContext, Professional, Center, Permission } from '../types';
import { emptyData } from '../data/empty';
import { api, ApiError } from '../services/api';
import { apiRepository } from '../db/apiRepository';
import { clearSearchDraft } from '../services/searchDraft';
import type { EntryCentre, WorkplaceSelection } from '../features/authentication/entryContext';
interface EmployeeView {
  employeeId: string;
  sessionId: string;
  centreIds: string[];
  centres: EntryCentre[];
  selectedCentreId: string | null;
  professional: Professional;
  capabilities: string[];
}
interface AppStore {
  data: AppData;
  session: SessionContext | null;
  ready: boolean;
  storage: 'loading' | 'saving' | 'saved' | 'error';
  error: string | null;
  revision: number;
  identityMode: string;
  authenticating: boolean;
  centreChoices: EntryCentre[];
  initialize: () => Promise<void>;
  signIn: (id: string, workplace?: WorkplaceSelection) => Promise<void>;
  selectCentre: (workplace: WorkplaceSelection) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  mutate: <T>(fn: (data: AppData, session: SessionContext) => T) => Promise<T>;
  reset: () => Promise<void>;
  retry: () => Promise<void>;
}
function sessionView(me: EmployeeView, data: AppData): SessionContext {
  const kinds = [
    'case',
    'form',
    'document',
    'observation',
    'evaluation',
    'project',
    'activity',
    'workshop',
    'intervention',
    'resource',
    'appointment',
    'task',
    'partner',
  ];
  const permissions = [
    ...kinds.map((k) => `${k}.read`),
    'search.use',
    'recommendation.use',
    'recommendation.validate',
    ...(me.capabilities.includes('interventions.plan') ? ['workshop.plan'] : []),
  ];
  return {
    authority: 'server',
    sessionId: me.sessionId,
    capabilities: me.capabilities,
    authorizedCentreIds: me.centreIds,
    userId: me.employeeId,
    professionalId: me.employeeId,
    professionalRole: me.professional.role,
    role: me.professional.role,
    cdisId: me.professional.centerId,
    centerId: me.professional.centerId,
    assignedCaseIds: data.cases.map((c) => c.id),
    permissions: permissions as Permission[],
    attributes: {
      active: true,
      caseScope: 'assigned',
      canRecommend: me.capabilities.includes('recommendation.use'),
    },
    simulation: true,
  };
}
let initializing: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;
let refreshing: Promise<void> | undefined;
export const useAppStore = create<AppStore>((set, get) => ({
  data: emptyData(),
  session: null,
  ready: false,
  storage: 'loading',
  error: null,
  revision: 0,
  identityMode: 'unavailable',
  authenticating: false,
  centreChoices: [],
  initialize: () => {
    initializing ??= (async () => {
      try {
        // Remove the obsolete app-owned offline projection; PostgreSQL remains authoritative.
        // No dossier is persisted to browser storage in the full-stack application.
        if (typeof indexedDB !== 'undefined') indexedDB.deleteDatabase('masar-demo-v1');
        const bootstrap = await api<{
          professionals: Professional[];
          centers: Center[];
          identity_mode: string;
        }>('/bootstrap');
        set({
          identityMode: bootstrap.identity_mode,
          data: {
            ...emptyData(),
            professionals: bootstrap.professionals,
            centers: bootstrap.centers,
          },
        });
        try {
          const me = await api<EmployeeView>('/me');
          const data = await apiRepository.load();
          set({ data, session: sessionView(me, data), centreChoices: me.centres });
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 401)) throw error;
        }
        set({ ready: true, storage: 'saved', error: null });
      } catch (error) {
        set({ ready: true, storage: 'error', error: String(error) });
      }
    })();
    return initializing;
  },
  signIn: async (id, workplace) => {
    clearSearchDraft();
    const version = ++generation;
    set({
      authenticating: true,
      session: null,
      data: {
        ...emptyData(),
        professionals: get().data.professionals,
        centers: get().data.centers,
      },
      storage: 'loading',
      revision: get().revision + 1,
    });
    try {
      await api('/auth/demo/login', {
        employee_id: id,
        ...(workplace
          ? { governorate_id: workplace.governorateId, centre_id: workplace.centreId }
          : {}),
      });
      const me = await api<EmployeeView>('/me');
      const data = await apiRepository.load();
      if (version === generation)
        set({
          data,
          session: sessionView(me, data),
          authenticating: false,
          centreChoices: me.centres,
          storage: 'saved',
          error: null,
        });
    } catch (error) {
      if (version === generation)
        set({ authenticating: false, storage: 'error', error: String(error) });
      throw error;
    }
  },
  selectCentre: async (workplace) => {
    const version = ++generation;
    clearSearchDraft();
    await api('/auth/centre', {
      governorate_id: workplace.governorateId,
      centre_id: workplace.centreId,
    });
    const me = await api<EmployeeView>('/me');
    const data = await apiRepository.load();
    if (version === generation)
      set({
        data,
        session: sessionView(me, data),
        centreChoices: me.centres,
        revision: get().revision + 1,
        storage: 'saved',
        error: null,
      });
  },
  signOut: () => {
    clearSearchDraft();
    ++generation;
    set({
      authenticating: false,
      session: null,
      centreChoices: [],
      data: {
        ...emptyData(),
      },
      revision: get().revision + 1,
    });
    void api('/auth/logout').catch(() => undefined);
  },
  refresh: () => {
    if (refreshing) return refreshing;
    if (!get().session) return Promise.resolve();
    refreshing = (async () => {
      const version = generation;
      try {
        const data = await apiRepository.load();
        if (version !== generation) return;
        if (JSON.stringify(data) !== JSON.stringify(get().data))
          set({
            data,
            session: { ...get().session!, assignedCaseIds: data.cases.map((c) => c.id) },
            revision: get().revision + 1,
            storage: 'saved',
            error: null,
          });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) get().signOut();
        else set({ error: String(error), storage: 'error' });
      }
    })().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  },
  mutate: <T>(fn: (data: AppData, session: SessionContext) => T) => {
    const session = get().session;
    if (!session) return Promise.reject(Error('SESSION'));
    const version = generation;
    const operation = queue
      .catch(() => undefined)
      .then(async () => {
        if (version !== generation) throw Error('SESSION_CHANGED');
        const before = get().data;
        const after = structuredClone(before);
        const result = fn(after, session);
        set({ storage: 'saving', error: null });
        try {
          await apiRepository.commit(before, after, session);
          if (version === generation) {
            const data = await apiRepository.load();
            set({ data, storage: 'saved', revision: get().revision + 1 });
          }
          return result;
        } catch (error) {
          if (version === generation) {
            set({ storage: 'error', error: String(error) });
            await get().refresh();
          }
          throw error;
        }
      });
    queue = operation;
    return operation;
  },
  reset: async () => {
    throw Error('SERVER_RESET_DISABLED');
  },
  retry: async () => {
    initializing = undefined;
    if (get().session) await get().refresh();
    else await get().initialize();
  },
}));
