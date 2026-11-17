import catalogue from '../../../config/governorates.json';
import type { Bi, Center, Role } from '../../types';

export const governorates = catalogue;
export interface Governorate {
  id: string;
  name: Bi;
}
export interface EntryCentre extends Center {
  governorateId: string;
  isDemo: boolean;
}
export interface DemoProfessional {
  id: string;
  name: Bi;
  role: Role;
  specialty: Bi;
  centerId: string;
}
export interface WorkplaceSelection {
  governorateId: string;
  centreId: string;
}
const selectionKey = 'masar.entry.workplace';
const returnKey = 'masar.entry.return';
const maxAge = 30 * 60 * 1000;

export function saveWorkplace(value: WorkplaceSelection) {
  try {
    sessionStorage.setItem(
      selectionKey,
      JSON.stringify({ ...value, expires: Date.now() + maxAge }),
    );
  } catch {
    /* In-memory selection remains usable. */
  }
}
export function readWorkplace(): WorkplaceSelection | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(selectionKey) ?? 'null') as
      (WorkplaceSelection & { expires: number }) | null;
    return v &&
      v.expires > Date.now() &&
      governorates.some((g) => g.id === v.governorateId) &&
      typeof v.centreId === 'string' &&
      /^[\w-]{0,64}$/.test(v.centreId)
      ? { governorateId: v.governorateId, centreId: v.centreId }
      : null;
  } catch {
    return null;
  }
}

/** Explicit internal routes only; discard arbitrary queries, fragments and encoded paths. */
export function safeReturnPath(value: unknown): string | null {
  if (
    typeof value !== 'string' ||
    value.length > 220 ||
    /[\\%#\s]/.test(value) ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return null;
  const [path, query = ''] = value.split('?');
  if (
    !/^\/(?:dashboard|assigned-children|child-journey(?:\/CDIS-\d{3,8})?|cases(?:\/CDIS-\d{3,8})?|documents(?:\/CDIS-\d{3,8}\/F(?:0[1-9]|1[0-5]))?|interviews|assessments|projects|integration|library|recommendations|sessions|attendance|search|network|calendar|tasks|journey|supervision|national|reports|professionals|settings|interventions)$/.test(
      path,
    )
  )
    return null;
  const validStage = path.startsWith('/child-journey/') && /^stage=[1-5]$/.test(query);
  const validTab =
    /^\/cases\/CDIS-\d{3,8}$/.test(path) &&
    /^tab=(overview|identity|family|social|interviews|psychological|educational|multidisciplinary|project|interventions|activities|recommendations|documents|integration|history)$/.test(
      query,
    );
  const validForumTab = path === '/network' && /^tab=(feed|messages)$/.test(query);
  return validStage || validTab || validForumTab ? `${path}?${query}` : path;
}
export function saveReturnPath(value: unknown) {
  const path = safeReturnPath(value);
  if (path)
    try {
      sessionStorage.setItem(returnKey, JSON.stringify({ path, expires: Date.now() + maxAge }));
    } catch {
      /* No external redirect is ever accepted. */
    }
}
export function returnPath() {
  try {
    const value = JSON.parse(sessionStorage.getItem(returnKey) ?? 'null') as {
      path?: string;
      expires?: number;
    } | null;
    return value && (value.expires ?? 0) > Date.now()
      ? (safeReturnPath(value.path) ?? '/assigned-children')
      : '/assigned-children';
  } catch {
    return '/assigned-children';
  }
}
export function clearReturnPath() {
  try {
    sessionStorage.removeItem(returnKey);
  } catch {
    /* Optional browser storage. */
  }
}
export function normalizeEntrySearch(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}
