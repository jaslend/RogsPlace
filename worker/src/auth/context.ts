import type { Env } from '../env';
import { problem } from '../http';
import { readInvite } from './invite';
import { readCookie, readSessionToken, SESSION_COOKIE, type Role } from './session';

/**
 * Works out who is asking.
 *
 * A session is only honoured while its `ver` still matches the current
 * invitation, so rotating the invite signs out everyone who redeemed the old
 * link -- without storing a single session anywhere.
 */
export async function resolveRole(request: Request, env: Env): Promise<Role> {
  const token = readCookie(request, SESSION_COOKIE);
  if (token === null) return 'visitor';

  const session = await readSessionToken(env, token);
  if (session === null) return 'visitor';

  if (session.role === 'contributor') {
    const invite = await readInvite(env);
    const currentVersion = invite === null ? null : invite.version;
    if (currentVersion === null || session.ver !== currentVersion) return 'visitor';
  }

  return session.role;
}

const MAY_CONTRIBUTE: readonly Role[] = ['contributor', 'administrator'];

/**
 * Refuses a request that is not entitled to contribute.
 *
 * Returns a response to send, or null to carry on. Every write endpoint calls
 * this for itself: the router grants nothing by pattern, so a route added later
 * is closed until somebody opens it deliberately.
 */
export function requireContributor(role: Role, request: Request, env: Env): Response | null {
  if (MAY_CONTRIBUTE.includes(role)) return null;

  return problem(
    401,
    'You need the family invitation link before you can add to this memorial.',
    request,
    env,
  );
}
