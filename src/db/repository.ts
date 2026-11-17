import { openDB } from 'idb';
import { z } from 'zod';
import type { AppData } from '../types';
import { apiRepository } from './apiRepository';
import {
  createPartnerStructures,
  createProfessionalResources,
  restrictedDemoProfessional,
} from '../data/seed/intelligence';
export interface Repository {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
  flush(): Promise<void>;
}
const tables = [
  'children',
  'families',
  'centers',
  'professionals',
  'assignments',
  'cases',
  'events',
  'submissions',
  'activities',
  'resources',
  'partners',
  'sessions',
  'recommendations',
  'appointments',
  'tasks',
  'integrations',
  'transfers',
  'posts',
  'conversations',
  'searchHistory',
] as const;
export const dataSchema = z.custom<AppData>((value: unknown) => {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    typeof v.demoDate === 'string' &&
    typeof v.searchHistories === 'object' &&
    v.searchHistories !== null &&
    tables.every((key) => Array.isArray(v[key])) &&
    (v.cases as Record<string, unknown>[]).every(
      (c) =>
        typeof c.id === 'string' &&
        typeof c.childId === 'string' &&
        [1, 2, 3, 4, 5].includes(Number(c.stage)) &&
        Array.isArray(c.goals) &&
        Array.isArray(c.decisions),
    ) &&
    (v.children as Record<string, unknown>[]).every(
      (c) =>
        typeof c.id === 'string' &&
        typeof c.birthDate === 'string' &&
        typeof c.name === 'object' &&
        c.name !== null,
    )
  );
}, 'Unsupported or corrupt MASAR data');
export class IndexedDbRepository implements Repository {
  private queue: Promise<void> = Promise.resolve();
  private db() {
    return openDB('masar-demo-v1', 1, {
      upgrade(db) {
        db.createObjectStore('state');
      },
    });
  }
  async load() {
    const db = await this.db();
    const raw: unknown = await db.get('state', 'app');
    return raw === undefined ? null : dataSchema.parse(migrateLocalData(raw));
  }
  save(data: AppData) {
    const snapshot = structuredClone(data);
    const operation = this.queue
      .catch(() => undefined)
      .then(async () => {
        const db = await this.db();
        await db.put('state', snapshot, 'app');
      });
    this.queue = operation;
    return operation;
  }
  flush() {
    return this.queue;
  }
}
// Legacy storage is retained only for explicit historical export/migration and regression tests.
export const legacyRepository = new IndexedDbRepository();
export const repository = apiRepository;

// Additive migration: retain every historical form, narrative and identity.
export function migrateLocalData(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || !('schemaVersion' in raw) || raw.schemaVersion !== 1)
    return raw;
  const data = structuredClone(raw) as AppData;
  data.resources ??= createProfessionalResources();
  data.partners ??= createPartnerStructures();
  data.searchHistories ??= {};
  if (Array.isArray(data.professionals) && !data.professionals.some((p) => p.id === 'p6')) {
    data.professionals.push(structuredClone(restrictedDemoProfessional));
    if (Array.isArray(data.assignments))
      data.assignments.push({ caseId: 'CDIS-024', professionalId: 'p6' });
  }
  return data;
}
