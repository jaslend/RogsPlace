/**
 * What a visitor is currently allowed to do.
 *
 * This governs what the interface offers, never what is permitted. The Worker
 * decides that, and re-checks on every request.
 */
export type Role = 'visitor' | 'contributor' | 'administrator';

export interface Session {
  role: Role;
}

/** True when the role may add memories and photographs. */
export function mayContribute(role: Role): boolean {
  return role === 'contributor' || role === 'administrator';
}
