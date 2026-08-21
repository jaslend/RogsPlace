import type { Env } from '../env';
import { keys, readJson } from '../storage';

/**
 * The single family invitation, as stored in configuration/invite.json.
 *
 * Only the hash of the token is kept. Someone who could read the bucket still
 * could not work out the link to share, and the stored value is useless as a
 * credential on its own.
 */
export interface InviteRecord {
  tokenHash: string;
  /**
   * Incremented every time the invitation is rotated. Sessions carry the
   * version they were issued against, so raising it signs everybody out.
   */
  version: number;
  rotatedAt: string;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Compares two hex digests without short-circuiting on the first difference.
 *
 * The attacker does not control the stored hash, so this is belt and braces
 * rather than strictly necessary -- but comparison of a secret-derived value is
 * exactly the place where the cheap habit is worth keeping.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return difference === 0;
}

export function readInvite(env: Env): Promise<InviteRecord | null> {
  return readJson<InviteRecord>(env, keys.invite);
}

/**
 * Checks a token against the stored invitation.
 *
 * Returns the version to issue a session against, or null when the token is
 * wrong or no invitation is active. Callers must not distinguish between those
 * two cases to the visitor.
 */
export async function redeemInvite(env: Env, token: string): Promise<number | null> {
  const invite = await readInvite(env);
  if (invite === null || typeof invite.tokenHash !== 'string') return null;

  const candidate = await hashToken(token);
  if (!timingSafeEqual(candidate, invite.tokenHash)) return null;

  return typeof invite.version === 'number' ? invite.version : 0;
}
