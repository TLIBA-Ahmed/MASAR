import type { AppData, Case, SessionContext } from '../types';
import { demoProfileOverrides, demoRoleAttributes, demoRolePermissions } from '../config/access';
import { accessPolicyService } from './accessPolicy';
export function createDemoSession(professionalId: string, data: AppData): SessionContext {
  const p = data.professionals.find((p) => p.id === professionalId);
  if (!p) throw Error('SESSION');
  const override = demoProfileOverrides[p.id];
  return {
    userId: p.id,
    professionalRole: p.role,
    cdisId: p.centerId,
    assignedCaseIds: data.assignments.filter((a) => a.professionalId === p.id).map((a) => a.caseId),
    permissions: [...(override?.permissions ?? demoRolePermissions[p.role])],
    attributes: { ...demoRoleAttributes[p.role], ...override?.attributes },
    professionalId: p.id,
    centerId: p.centerId,
    role: p.role,
    simulation: true,
  };
}
export interface AuthService {
  signIn(professionalId: string, data: AppData): Promise<SessionContext>;
  signOut(): void;
  current(data: AppData): SessionContext | null;
}
export class DemoAuthService implements AuthService {
  async signIn(professionalId: string, data: AppData) {
    const session = createDemoSession(professionalId, data);
    sessionStorage.setItem('masar.session', JSON.stringify(session));
    return session;
  }
  signOut() {
    sessionStorage.removeItem('masar.session');
  }
  current(data: AppData) {
    try {
      const s: SessionContext = JSON.parse(
        sessionStorage.getItem('masar.session') ?? 'null',
      ) as SessionContext;
      // Rebuild simulated grants from the current configuration, including old sessions.
      return s && data.professionals.some((p) => p.id === s.professionalId)
        ? createDemoSession(s.professionalId, data)
        : null;
    } catch {
      return null;
    }
  }
}
// Historical adapter kept for migration. Runtime sessions use the HttpOnly server cookie.
export const legacyDemoAuthService: AuthService = new DemoAuthService();
// UI simulation only. Production must authorize on the server before fetching records.
export function authorizedCases(data: AppData, session: SessionContext | null): Case[] {
  return accessPolicyService.authorizedCases(data, session);
}
export function requireCase(data: AppData, session: SessionContext, caseId: string) {
  const c = authorizedCases(data, session).find((c) => c.id === caseId);
  if (!c) throw Error('ACCESS');
  return c;
}
