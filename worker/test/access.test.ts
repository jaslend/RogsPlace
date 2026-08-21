import { SELF, env } from 'cloudflare:test';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAccessToken } from '../src/auth/access';
import { resolveRole } from '../src/auth/context';
import {
  AUDIENCE,
  accessToken,
  asAdministrator,
  resetAccessKeys,
  unsignedToken,
  useFakeAccessKeys,
} from './accessSupport';
import { SITE, cookieFor, giveInvite } from './support';

beforeAll(useFakeAccessKeys);
afterAll(() => vi.unstubAllGlobals());
beforeEach(resetAccessKeys);

function request(token: string): Request {
  return new Request(`${SITE}/api/admin/queue`, { headers: asAdministrator(token) });
}

describe('verifying an Access token', () => {
  it('accepts one signed by the published key', async () => {
    await expect(verifyAccessToken(env, await accessToken())).resolves.toMatchObject({
      email: 'admin@example.com',
    });
  });

  it('accepts an audience given as a bare string', async () => {
    await expect(verifyAccessToken(env, await accessToken({ aud: AUDIENCE }))).resolves.not.toBeNull();
  });

  it('refuses a token minted for a different Access application', async () => {
    // The same account can host several applications; one must not open another.
    await expect(
      verifyAccessToken(env, await accessToken({ aud: ['some-other-application'] })),
    ).resolves.toBeNull();
  });

  it('refuses a token from a different team', async () => {
    await expect(
      verifyAccessToken(env, await accessToken({ iss: 'https://someone-else.cloudflareaccess.com' })),
    ).resolves.toBeNull();
  });

  it('refuses an expired token', async () => {
    const expired = await accessToken({ exp: Math.floor(Date.now() / 1000) - 60 });

    await expect(verifyAccessToken(env, expired)).resolves.toBeNull();
  });

  it('refuses a token that is not valid yet', async () => {
    const early = await accessToken({ nbf: Math.floor(Date.now() / 1000) + 3600 });

    await expect(verifyAccessToken(env, early)).resolves.toBeNull();
  });

  it('refuses a token signed with a key Access does not publish', async () => {
    await expect(verifyAccessToken(env, await accessToken({ wrongKey: true }))).resolves.toBeNull();
  });

  it('refuses a token naming a key that does not exist', async () => {
    await expect(verifyAccessToken(env, await accessToken({ kid: 'invented' }))).resolves.toBeNull();
  });

  it('refuses an unsigned token claiming alg: none', async () => {
    // The classic JWT attack: assert that no signature was required.
    await expect(verifyAccessToken(env, unsignedToken())).resolves.toBeNull();
  });

  it('refuses a token asking for a weaker algorithm', async () => {
    await expect(verifyAccessToken(env, await accessToken({ alg: 'HS256' }))).resolves.toBeNull();
  });

  it.each([['not-a-token'], ['a.b'], [''], ['a.b.c.d']])('refuses the malformed token %o', async (token) => {
    await expect(verifyAccessToken(env, token)).resolves.toBeNull();
  });

  it('refuses everything when Access is not configured', async () => {
    const unconfigured = { ...env, ACCESS_AUD: '', ACCESS_TEAM_DOMAIN: '' };

    // No administrator exists until Access is set up, rather than everyone being one.
    await expect(verifyAccessToken(unconfigured, await accessToken())).resolves.toBeNull();
  });

  it('refuses when the audience is configured but the team domain is not', async () => {
    const partial = { ...env, ACCESS_TEAM_DOMAIN: '' };

    await expect(verifyAccessToken(partial, await accessToken())).resolves.toBeNull();
  });
});

describe('working out the role', () => {
  it('makes a holder of a valid Access token an administrator', async () => {
    await expect(resolveRole(request(await accessToken()), env)).resolves.toBe('administrator');
  });

  it('treats a rejected Access token as an anonymous visitor', async () => {
    await expect(resolveRole(request(unsignedToken()), env)).resolves.toBe('visitor');
  });

  it('never promotes a session cookie to administrator', async () => {
    await giveInvite();
    // A cookie claiming the role, signed with the real key. Administration does
    // not come from cookies at all, so it must not be honoured.
    const forged = await cookieFor('administrator');

    const claimed = new Request(`${SITE}/api/admin/queue`, { headers: { Cookie: forged } });

    await expect(resolveRole(claimed, env)).resolves.toBe('visitor');
  });

  it('falls back to the contributor cookie when no Access token is present', async () => {
    await giveInvite();
    const cookie = await cookieFor('contributor');

    const contributing = new Request(`${SITE}/api/memories`, { headers: { Cookie: cookie } });

    await expect(resolveRole(contributing, env)).resolves.toBe('contributor');
  });
});

describe('reaching the Worker without going through Access', () => {
  it('refuses an administrative request carrying no token at all', async () => {
    const response = await SELF.fetch(`${SITE}/api/admin/queue`, {
      headers: { Origin: SITE },
    });

    expect(response.status).toBe(403);
  });

  it('refuses an administrative request with a forged token', async () => {
    const response = await SELF.fetch(`${SITE}/api/admin/queue`, {
      headers: asAdministrator(unsignedToken()),
    });

    expect(response.status).toBe(403);
  });
});
