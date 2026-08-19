import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createSessionToken, readSessionToken } from '../src/auth/session';
import { hashToken, timingSafeEqual } from '../src/auth/invite';

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Signs an arbitrary payload with the real key, to forge tokens a client could not. */
async function forge(payload: object): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.SESSION_SIGNING_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const encoded = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encoded));

  return `${encoded}.${base64Url(new Uint8Array(signature))}`;
}

describe('session tokens', () => {
  it('round-trips a contributor session', async () => {
    const token = await createSessionToken(env, 'contributor', 3);

    await expect(readSessionToken(env, token!)).resolves.toMatchObject({
      role: 'contributor',
      ver: 3,
    });
  });

  it('rejects a token whose payload has been edited', async () => {
    const token = (await createSessionToken(env, 'contributor', 1))!;
    const [, signature] = token.split('.');
    const elevated = base64Url(
      encoder.encode(JSON.stringify({ role: 'administrator', ver: 1, exp: 9999999999 })),
    );

    // The classic attack: keep the signature, swap the payload for a better one.
    await expect(readSessionToken(env, `${elevated}.${signature}`)).resolves.toBeNull();
  });

  it('rejects a token signed with a different key', async () => {
    const token = (await createSessionToken(env, 'contributor', 1))!;

    const other = { ...env, SESSION_SIGNING_KEY: 'a-different-signing-key' };
    await expect(readSessionToken(other, token)).resolves.toBeNull();
  });

  it('rejects an expired token even though the signature is genuine', async () => {
    const expired = await forge({ role: 'contributor', ver: 1, exp: 1_600_000_000 });

    await expect(readSessionToken(env, expired)).resolves.toBeNull();
  });

  it('rejects a role it does not recognise', async () => {
    const invented = await forge({ role: 'superuser', ver: 1, exp: 9_999_999_999 });

    await expect(readSessionToken(env, invented)).resolves.toBeNull();
  });

  it.each([['no-separator'], ['.'], [''], ['a.b']])('rejects the malformed token %o', async (token) => {
    await expect(readSessionToken(env, token)).resolves.toBeNull();
  });

  it('refuses to issue or accept anything when no key is configured', async () => {
    const unconfigured = { ...env, SESSION_SIGNING_KEY: '' };

    // Failing closed: a missing secret must mean nobody is signed in, not that
    // everybody is.
    await expect(createSessionToken(unconfigured, 'contributor', 1)).resolves.toBeNull();

    const genuine = (await createSessionToken(env, 'contributor', 1))!;
    await expect(readSessionToken(unconfigured, genuine)).resolves.toBeNull();
  });
});

describe('invite hashing', () => {
  it('produces a stable hex digest', async () => {
    await expect(hashToken('token')).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(hashToken('token')).resolves.toBe(await hashToken('token'));
  });

  it('produces different digests for different tokens', async () => {
    expect(await hashToken('one')).not.toBe(await hashToken('two'));
  });

  it('compares equal-length values without short-circuiting', () => {
    expect(timingSafeEqual('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqual('abcd', 'abce')).toBe(false);
    expect(timingSafeEqual('abcd', 'abc')).toBe(false);
  });
});
