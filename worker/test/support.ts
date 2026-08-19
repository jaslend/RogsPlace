import { env } from 'cloudflare:test';
import { hashToken } from '../src/auth/invite';
import { SESSION_COOKIE, createSessionToken } from '../src/auth/session';
import { keys } from '../src/storage';

export const SITE = 'https://rogsplace.test';
export const INVITE_TOKEN = 'a-very-long-random-invitation-token-for-testing';

/** Stores an invitation, as the admin tooling will. */
export async function giveInvite(version = 1, token = INVITE_TOKEN): Promise<void> {
  await env.BUCKET.put(
    keys.invite,
    JSON.stringify({
      tokenHash: await hashToken(token),
      version,
      rotatedAt: '2026-08-19T00:00:00.000Z',
    }),
  );
}

/** A Cookie header carrying a valid session for the given role. */
export async function cookieFor(
  role: 'contributor' | 'administrator',
  version = 1,
): Promise<string> {
  const token = await createSessionToken(env, role, version);
  if (token === null) throw new Error('No signing key configured for the tests.');

  return `${SESSION_COOKIE}=${token}`;
}

/** Headers for a same-site request, which is what a browser would send. */
export function sameSite(cookie?: string): Record<string, string> {
  return {
    Origin: SITE,
    ...(cookie === undefined ? {} : { Cookie: cookie }),
  };
}

/** Bytes that begin with a real PNG signature, which is what the Worker sniffs. */
export function pngBytes(sizeInBytes = 64): Uint8Array {
  const bytes = new Uint8Array(sizeInBytes);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
  return bytes;
}

export function photoUpload(bytes: Uint8Array, fileName: string, type: string): FormData {
  const form = new FormData();
  form.append('photo', new File([bytes], fileName, { type }));
  return form;
}
