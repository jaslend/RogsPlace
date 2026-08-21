import type { Env } from '../env';
import { problem } from '../http';
import { accessTokenFrom, verifyAccessToken } from './access';
import { readInvite } from './invite';
import { readCookie, readSessionToken, SESSION_COOKIE, type Role } from './session';

/**
 * Works out who is asking.
 *
 * The two roles are established by entirely separate means. An administrator is
 * whoever holds a valid Cloudflare Access token -- never a session cookie, so
 * there is nothing to forge and no way to be promoted by one. A contributor is
 * whoever holds a session cookie issued against the current invitation; the
 * version check means rotating the invite signs out everyone who redeemed the
 * old link, without storing a single session anywhere.
 */
export async function resolveRole(request: Request, env: Env): Promise<Role> {
  const accessToken = accessTokenFrom(request);
  if (accessToken !== null) {
    const identity = await verifyAccessToken(env, accessToken);
    if (identity !== null) return 'administrator';
  }

  const token = readCookie(request, SESSION_COOKIE);
  if (token === null) return 'visitor';

  const session = await readSessionToken(env, token);
  // A cookie can only ever make somebody a contributor.
  if (session === null || session.role !== 'contributor') return 'visitor';

  const invite = await readInvite(env);
  if (invite === null || session.ver !== invite.version) return 'visitor';

  return 'contributor';
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

/**
 * Refuses a request that is not from an administrator.
 *
 * Access should already have stopped anyone else at the edge, so reaching this
 * means either Access is not configured, or the request arrived by some route
 * that bypasses it. Both are refused here.
 */
export function requireAdministrator(role: Role, request: Request, env: Env): Response | null {
  if (role === 'administrator') return null;

  return problem(403, 'That is only available to whoever looks after this memorial.', request, env);
}
