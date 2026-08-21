import { SELF, env } from 'cloudflare:test';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { keys } from '../src/storage';
import type { Memory, SiteConfig } from '../src/types';
import {
  accessToken,
  asAdministrator,
  resetAccessKeys,
  useFakeAccessKeys,
} from './accessSupport';
import {
  SITE,
  cookieFor,
  giveInvite,
  photoUpload,
  pngBytes,
  resetStorage,
  sameSite,
} from './support';

let admin: Record<string, string>;
let contributor: string;

beforeAll(useFakeAccessKeys);
afterAll(() => vi.unstubAllGlobals());

beforeEach(async () => {
  resetAccessKeys();
  await resetStorage();
  await giveInvite();
  admin = asAdministrator(await accessToken());
  contributor = await cookieFor('contributor');
});

/** Submits a memory as a contributor and returns its identifier. */
async function submitMemory(message = 'A memory worth keeping.'): Promise<string> {
  const response = await SELF.fetch(`${SITE}/api/memories`, {
    method: 'POST',
    headers: { ...sameSite(contributor), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Alex', message }),
  });

  return ((await response.json()) as { id: string }).id;
}

async function uploadPhoto(): Promise<string> {
  const response = await SELF.fetch(`${SITE}/api/photos`, {
    method: 'POST',
    headers: sameSite(contributor),
    body: photoUpload(pngBytes(), 'holiday.png', 'image/png'),
  });

  return ((await response.json()) as { id: string }).id;
}

function adminPost(path: string): Promise<Response> {
  return SELF.fetch(`${SITE}${path}`, { method: 'POST', headers: admin });
}

describe('the moderation queue', () => {
  it('shows what is waiting', async () => {
    const memoryId = await submitMemory();
    const photoId = await uploadPhoto();

    const response = await SELF.fetch(`${SITE}/api/admin/queue`, { headers: admin });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      memories: Memory[];
      photos: { id: string; url: string }[];
    };
    expect(body.memories.map((memory) => memory.id)).toEqual([memoryId]);
    expect(body.photos.map((photo) => photo.id)).toEqual([photoId]);
  });

  it('empties as things are dealt with', async () => {
    const memoryId = await submitMemory();
    await adminPost(`/api/admin/memories/${memoryId}/approve`);

    const body = (await (await SELF.fetch(`${SITE}/api/admin/queue`, { headers: admin })).json()) as {
      memories: Memory[];
    };
    expect(body.memories).toEqual([]);
  });

  it('lets an administrator see a photograph that is still waiting', async () => {
    const photoId = await uploadPhoto();

    const asAdmin = await SELF.fetch(`${SITE}/api/photos/${photoId}/image`, { headers: admin });
    const asVisitor = await SELF.fetch(`${SITE}/api/photos/${photoId}/image`);

    // They have to look at it to moderate it; nobody else may.
    expect(asAdmin.status).toBe(200);
    expect(asVisitor.status).toBe(404);
  });
});

describe('approving a memory', () => {
  it('publishes it', async () => {
    const id = await submitMemory('The published one.');

    expect((await adminPost(`/api/admin/memories/${id}/approve`)).status).toBe(200);

    const published = (await (await SELF.fetch(`${SITE}/api/memories`)).json()) as Memory[];
    expect(published.map((memory) => memory.id)).toEqual([id]);
  });

  it('keeps the index newest first', async () => {
    const older = await submitMemory('Older.');
    await adminPost(`/api/admin/memories/${older}/approve`);
    const newer = await submitMemory('Newer.');
    await adminPost(`/api/admin/memories/${newer}/approve`);

    const published = (await (await SELF.fetch(`${SITE}/api/memories`)).json()) as Memory[];
    expect(published.map((memory) => memory.id)).toEqual([newer, older]);
  });

  it('does not publish the moderation status alongside it', async () => {
    const id = await submitMemory();
    await adminPost(`/api/admin/memories/${id}/approve`);

    const [published] = (await (await SELF.fetch(`${SITE}/api/memories`)).json()) as Memory[];
    expect(published).not.toHaveProperty('status');
  });

  it('answers 404 for a memory that does not exist', async () => {
    expect((await adminPost('/api/admin/memories/no-such-memory/approve')).status).toBe(404);
  });

  it('refuses an identifier that could escape its prefix', async () => {
    expect((await adminPost('/api/admin/memories/..%2F..%2Fconfiguration/approve')).status).toBe(404);
  });
});

describe('removing things', () => {
  it('deletes a memory rather than filing it away', async () => {
    const id = await submitMemory();

    expect((await adminPost(`/api/admin/memories/${id}/remove`)).status).toBe(200);

    // Nothing an administrator rejected should linger in the bucket.
    expect(await env.BUCKET.get(keys.memory(id))).toBeNull();
  });

  it('takes an approved memory back out of the published list', async () => {
    const id = await submitMemory();
    await adminPost(`/api/admin/memories/${id}/approve`);
    await adminPost(`/api/admin/memories/${id}/remove`);

    await expect((await SELF.fetch(`${SITE}/api/memories`)).json()).resolves.toEqual([]);
  });

  it('deletes the files behind a photograph', async () => {
    const id = await uploadPhoto();

    await adminPost(`/api/admin/photos/${id}/remove`);

    expect(await env.BUCKET.get(keys.photoMetadata(id))).toBeNull();
    expect(await env.BUCKET.get(keys.photoOriginal(id, 'png'))).toBeNull();
  });
});

describe('approving a photograph', () => {
  it('publishes it and makes it visible to everyone', async () => {
    const id = await uploadPhoto();

    await adminPost(`/api/admin/photos/${id}/approve`);

    const gallery = (await (await SELF.fetch(`${SITE}/api/photos`)).json()) as { id: string }[];
    expect(gallery.map((photo) => photo.id)).toEqual([id]);
    expect((await SELF.fetch(`${SITE}/api/photos/${id}/image`)).status).toBe(200);
  });
});

describe('editing the memorial details', () => {
  const details: SiteConfig = {
    title: 'In Loving Memory',
    name: 'Someone Remembered',
    dateOfBirth: '1938-04-17',
    dateOfDeath: '2026-02-03',
    welcomeText: 'A few words.',
    mainPhoto: '',
  };

  it('saves them and serves them back', async () => {
    const response = await SELF.fetch(`${SITE}/api/config`, {
      method: 'PUT',
      headers: { ...admin, 'Content-Type': 'application/json' },
      body: JSON.stringify(details),
    });

    expect(response.status).toBe(200);
    await expect((await SELF.fetch(`${SITE}/api/config`)).json()).resolves.toEqual(details);
  });

  it('keeps an unknown date blank rather than inventing anything', async () => {
    await SELF.fetch(`${SITE}/api/config`, {
      method: 'PUT',
      headers: { ...admin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...details, dateOfBirth: '', dateOfDeath: '' }),
    });

    const saved = (await (await SELF.fetch(`${SITE}/api/config`)).json()) as SiteConfig;
    expect(saved.dateOfBirth).toBe('');
  });

  it.each([
    [{ ...details, name: 42 }, 'a name that is not text'],
    [{ ...details, welcomeText: 'w'.repeat(5000) }, 'an overlong welcome'],
    [{ title: 'Only this one' }, 'missing fields'],
  ])('refuses %o (%s)', async (body, _description) => {
    const response = await SELF.fetch(`${SITE}/api/config`, {
      method: 'PUT',
      headers: { ...admin, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
  });
});

describe('rotating the invitation', () => {
  it('returns a new token once and raises the version', async () => {
    const response = await adminPost('/api/admin/invite/rotate');

    expect(response.status).toBe(200);
    const { token, version } = (await response.json()) as { token: string; version: number };
    expect(token.length).toBeGreaterThan(30);
    expect(version).toBe(2);

    // The new one works.
    const redeemed = await SELF.fetch(`${SITE}/api/auth/invite`, {
      method: 'POST',
      headers: { ...sameSite(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(redeemed.status).toBe(200);
  });

  it('signs out everyone holding the previous link', async () => {
    await adminPost('/api/admin/invite/rotate');

    const stillUsingTheOldOne = await SELF.fetch(`${SITE}/api/auth/session`, {
      headers: sameSite(contributor),
    });

    await expect(stillUsingTheOldOne.json()).resolves.toEqual({ role: 'visitor' });
  });

  it('stores only the hash, never the token', async () => {
    const { token } = (await (await adminPost('/api/admin/invite/rotate')).json()) as {
      token: string;
    };

    const stored = await (await env.BUCKET.get(keys.invite))?.text();
    expect(stored).not.toContain(token);
  });
});

/** The administrative half of the matrix from the security plan. */
describe('who may administer', () => {
  const routes = [
    { name: 'GET /api/admin/queue', path: '/api/admin/queue', method: 'GET' },
    { name: 'POST approve memory', path: '/api/admin/memories/some-id/approve', method: 'POST' },
    { name: 'POST remove memory', path: '/api/admin/memories/some-id/remove', method: 'POST' },
    { name: 'POST approve photo', path: '/api/admin/photos/some-id/approve', method: 'POST' },
    { name: 'POST remove photo', path: '/api/admin/photos/some-id/remove', method: 'POST' },
    { name: 'PUT /api/config', path: '/api/config', method: 'PUT' },
    { name: 'POST rotate invite', path: '/api/admin/invite/rotate', method: 'POST' },
  ];

  it.each(routes)('$name refuses a visitor', async ({ path, method }) => {
    const response = await SELF.fetch(`${SITE}${path}`, {
      method,
      headers: sameSite(),
      body: method === 'GET' ? undefined : '{}',
    });

    expect(response.status).toBe(403);
  });

  it.each(routes)('$name refuses a contributor', async ({ path, method }) => {
    const response = await SELF.fetch(`${SITE}${path}`, {
      method,
      headers: sameSite(contributor),
      body: method === 'GET' ? undefined : '{}',
    });

    // Holding the family invitation is not the same as looking after the site.
    expect(response.status).toBe(403);
  });

  it.each(routes)('$name refuses an administrator posting from another site', async ({ path, method }) => {
    const response = await SELF.fetch(`${SITE}${path}`, {
      method,
      headers: { ...admin, Origin: 'https://evil.example' },
      body: method === 'GET' ? undefined : '{}',
    });

    expect(response.status).toBe(403);
  });
});
