import { env } from 'cloudflare:test';
import { hashToken } from '../src/auth/invite';
import { SESSION_COOKIE, createSessionToken } from '../src/auth/session';
import { keys } from '../src/storage';

export const SITE = 'https://rogsplace.test';
export const INVITE_TOKEN = 'a-very-long-random-invitation-token-for-testing';

/**
 * Empties the bucket.
 *
 * The pool does not isolate storage between individual tests, so each one
 * clears up after the last. Without this, tests pass or fail depending on the
 * order they happen to run in.
 */
export async function resetStorage(): Promise<void> {
  let cursor: string | undefined;

  do {
    const listing = await env.BUCKET.list({ cursor });
    if (listing.objects.length > 0) {
      await env.BUCKET.delete(listing.objects.map((object) => object.key));
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor !== undefined);
}

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

/** Bytes that begin with a real JPEG signature, which is what a thumbnail must be. */
export function jpegBytes(sizeInBytes = 64): Uint8Array {
  const bytes = new Uint8Array(sizeInBytes);
  bytes.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  return bytes;
}

export function photoUpload(
  bytes: Uint8Array,
  fileName: string,
  type: string,
  thumbnail?: File,
): FormData {
  const form = new FormData();
  form.append('photo', new File([bytes], fileName, { type }));
  if (thumbnail !== undefined) form.append('thumbnail', thumbnail);
  return form;
}

/** The thumbnail the browser generates alongside the photograph. */
export function thumbnailFile(bytes: Uint8Array = jpegBytes()): File {
  return new File([bytes], 'thumbnail.jpg', { type: 'image/jpeg' });
}
