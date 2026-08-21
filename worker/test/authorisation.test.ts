import { SELF, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { keys } from '../src/storage';
import {
  INVITE_TOKEN,
  SITE,
  cookieFor,
  giveInvite,
  photoUpload,
  pngBytes,
  resetStorage,
  sameSite,
} from './support';

beforeEach(async () => {
  await resetStorage();
  await giveInvite();
});

describe('redeeming the family invitation', () => {
  it('issues a session cookie for the right token', async () => {
    const response = await SELF.fetch(`${SITE}/api/auth/invite`, {
      method: 'POST',
      headers: { ...sameSite(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: INVITE_TOKEN }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ role: 'contributor' });

    const cookie = response.headers.get('Set-Cookie') ?? '';
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('refuses the wrong token', async () => {
    const response = await SELF.fetch(`${SITE}/api/auth/invite`, {
      method: 'POST',
      headers: { ...sameSite(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'not-the-invitation' }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('answers identically when no invitation is configured', async () => {
    await env.BUCKET.delete(keys.invite);

    const response = await SELF.fetch(`${SITE}/api/auth/invite`, {
      method: 'POST',
      headers: { ...sameSite(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: INVITE_TOKEN }),
    });

    // Same status as a wrong token: neither case tells the caller about the other.
    expect(response.status).toBe(401);
  });

  it('refuses a redemption posted from another site', async () => {
    const response = await SELF.fetch(`${SITE}/api/auth/invite`, {
      method: 'POST',
      headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: INVITE_TOKEN }),
    });

    expect(response.status).toBe(403);
  });

  it('refuses an absurdly long token without looking it up', async () => {
    const response = await SELF.fetch(`${SITE}/api/auth/invite`, {
      method: 'POST',
      headers: { ...sameSite(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'x'.repeat(5000) }),
    });

    expect(response.status).toBe(401);
  });
});

describe('rotating the invitation', () => {
  it('signs out sessions issued against the previous one', async () => {
    const cookie = await cookieFor('contributor', 1);

    // Still a contributor while the versions agree.
    await expect(
      (await SELF.fetch(`${SITE}/api/auth/session`, { headers: sameSite(cookie) })).json(),
    ).resolves.toEqual({ role: 'contributor' });

    await giveInvite(2, 'a-brand-new-invitation-token');

    await expect(
      (await SELF.fetch(`${SITE}/api/auth/session`, { headers: sameSite(cookie) })).json(),
    ).resolves.toEqual({ role: 'visitor' });
  });

  it('treats a session as anonymous once the invitation is withdrawn entirely', async () => {
    const cookie = await cookieFor('contributor', 1);
    await env.BUCKET.delete(keys.invite);

    await expect(
      (await SELF.fetch(`${SITE}/api/auth/session`, { headers: sameSite(cookie) })).json(),
    ).resolves.toEqual({ role: 'visitor' });
  });
});

describe('the session endpoint', () => {
  it('reports a visitor when there is no cookie', async () => {
    await expect((await SELF.fetch(`${SITE}/api/auth/session`)).json()).resolves.toEqual({
      role: 'visitor',
    });
  });

  it('ignores a cookie that is not a valid token', async () => {
    const response = await SELF.fetch(`${SITE}/api/auth/session`, {
      headers: { Cookie: 'rp_session=made-up-value' },
    });

    await expect(response.json()).resolves.toEqual({ role: 'visitor' });
  });

  it('clears the cookie on logout', async () => {
    const response = await SELF.fetch(`${SITE}/api/auth/logout`, {
      method: 'POST',
      headers: sameSite(await cookieFor('contributor')),
    });

    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});

/**
 * The matrix from the security plan, walked one row at a time.
 *
 * This is the test that catches a route added later without a guard: if an
 * endpoint stops refusing an anonymous caller, exactly one line here goes red.
 */
describe('what each role may do', () => {
  interface WriteEndpoint {
    name: string;
    path: string;
    /** Built fresh per test: a FormData body cannot be reused. */
    body: () => BodyInit;
    headers: Record<string, string>;
    contributorStatus: number;
  }

  const writes: WriteEndpoint[] = [
    {
      name: 'POST /api/memories',
      path: '/api/memories',
      body: () => JSON.stringify({ name: 'Alex', message: 'A memory.' }),
      headers: { 'Content-Type': 'application/json' },
      contributorStatus: 202,
    },
    {
      name: 'POST /api/photos',
      path: '/api/photos',
      body: () => photoUpload(pngBytes(), 'photo.png', 'image/png'),
      headers: {},
      contributorStatus: 202,
    },
  ];

  it.each(writes)('$name refuses a visitor', async ({ path, body, headers }) => {
    const response = await SELF.fetch(`${SITE}${path}`, {
      method: 'POST',
      headers: { ...headers, ...sameSite() },
      body: body(),
    });

    expect(response.status).toBe(401);
  });

  it.each(writes)('$name accepts a contributor', async ({ path, body, headers, contributorStatus }) => {
    const cookie = await cookieFor('contributor');

    const response = await SELF.fetch(`${SITE}${path}`, {
      method: 'POST',
      headers: { ...headers, ...sameSite(cookie) },
      body: body(),
    });

    expect(response.status).toBe(contributorStatus);
  });

  it.each(writes)(
    '$name refuses a contributor posting from another site',
    async ({ path, body, headers }) => {
      const cookie = await cookieFor('contributor');

      const response = await SELF.fetch(`${SITE}${path}`, {
        method: 'POST',
        headers: { ...headers, Origin: 'https://evil.example', Cookie: cookie },
        body: body(),
      });

      expect(response.status).toBe(403);
    },
  );

  it.each([
    '/api/memories/some-id',
    '/api/photos/some-id',
    '/api/admin/anything-else',
  ])('leaves %s unrouted rather than half-open', async (path) => {
    const response = await SELF.fetch(`${SITE}${path}`, {
      method: 'PUT',
      headers: sameSite(await cookieFor('contributor')),
      body: '{}',
    });

    // The router grants nothing by pattern: a path it does not name is a 404,
    // not something that falls through to a handler.
    expect(response.status).toBe(404);
  });
});
