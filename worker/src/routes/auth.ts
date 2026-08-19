import { resolveRole } from '../auth/context';
import { redeemInvite } from '../auth/invite';
import {
  clearedSessionCookie,
  createSessionToken,
  sessionCookie,
  type Role,
} from '../auth/session';
import type { Env } from '../env';
import { hasTrustedOrigin, json, problem } from '../http';

interface RedeemRequest {
  token?: unknown;
}

/** What the browser is told about itself. Never includes the token. */
interface SessionResponse {
  role: Role;
}

/**
 * Exchanges the family invitation for a session.
 *
 * A wrong token and an unconfigured invitation are answered identically, so
 * neither confirms anything about the other.
 */
export async function redeem(request: Request, env: Env): Promise<Response> {
  if (!hasTrustedOrigin(request, env)) {
    return problem(403, 'That request did not come from this site.', request, env);
  }

  let body: RedeemRequest;
  try {
    body = (await request.json()) as RedeemRequest;
  } catch {
    return problem(400, 'That invitation could not be read.', request, env);
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  // Bounded before any work is done with it.
  if (token === '' || token.length > 256) {
    return problem(401, 'That invitation link is not valid.', request, env);
  }

  const version = await redeemInvite(env, token);
  if (version === null) {
    return problem(
      401,
      'That invitation link is not valid. It may have been replaced -- please ask whoever invited you for the current one.',
      request,
      env,
    );
  }

  const sessionToken = await createSessionToken(env, 'contributor', version);
  if (sessionToken === null) {
    return problem(503, 'Invitations are not available at the moment.', request, env);
  }

  return json({ role: 'contributor' } satisfies SessionResponse, request, env, {
    headers: { 'Set-Cookie': sessionCookie(sessionToken) },
  });
}

/** Tells the browser which role it currently holds, so the UI can match it. */
export async function session(request: Request, env: Env): Promise<Response> {
  const role = await resolveRole(request, env);

  return json({ role } satisfies SessionResponse, request, env);
}

export function logout(request: Request, env: Env): Response {
  return json({ role: 'visitor' } satisfies SessionResponse, request, env, {
    headers: { 'Set-Cookie': clearedSessionCookie() },
  });
}
