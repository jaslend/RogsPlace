import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import placeholder from '../../src/data/site.json';
import { keys } from '../src/storage';
import { resetStorage } from './support';
import type { Memory, PhotoIndexEntry, StoredPhoto } from '../src/types';

const SITE = 'https://rogsplace.test';

async function put(key: string, body: unknown): Promise<void> {
  await env.BUCKET.put(key, JSON.stringify(body));
}

async function storePhoto(photo: StoredPhoto): Promise<void> {
  await put(keys.photoMetadata(photo.id), photo);
  await env.BUCKET.put(keys.photoOriginal(photo.id, photo.originalExtension), 'original-bytes');
  await env.BUCKET.put(keys.photoThumbnail(photo.id), 'thumbnail-bytes');
}

/** Reads a binary body without the runtime warning that .text() produces. */
async function bodyAsText(response: Response): Promise<string> {
  return new TextDecoder().decode(await response.arrayBuffer());
}

const publishedPhoto: StoredPhoto = {
  id: 'photo-one',
  caption: 'A published photograph',
  status: 'published',
  originalExtension: 'jpg',
  contentType: 'image/jpeg',
};

beforeEach(resetStorage);

describe('GET /api/config', () => {
  it('falls back to the committed placeholder when the bucket is empty', async () => {
    const response = await SELF.fetch(`${SITE}/api/config`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(placeholder);
  });

  it('serves the stored configuration once it exists', async () => {
    const stored = { ...placeholder, name: 'Someone Remembered', dateOfBirth: '1938-04-17' };
    await put(keys.siteConfig, stored);

    await expect((await SELF.fetch(`${SITE}/api/config`)).json()).resolves.toEqual(stored);
  });
});

describe('GET /api/memories', () => {
  it('returns an empty list rather than failing on an unseeded bucket', async () => {
    const response = await SELF.fetch(`${SITE}/api/memories`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([]);
  });

  it('serves the published index', async () => {
    const memories: Memory[] = [
      { id: 'a', name: 'Alex', message: 'A memory.', created: '2026-06-01T00:00:00.000Z' },
    ];
    await put(keys.memoriesIndex, memories);

    await expect((await SELF.fetch(`${SITE}/api/memories`)).json()).resolves.toEqual(memories);
  });
});

describe('GET /api/photos', () => {
  it('builds image URLs from the requested origin, so stored data is portable', async () => {
    const entries: PhotoIndexEntry[] = [{ id: 'photo-one', caption: 'A published photograph' }];
    await put(keys.photosIndex, entries);

    const response = await SELF.fetch(`${SITE}/api/photos`);

    await expect(response.json()).resolves.toEqual([
      {
        id: 'photo-one',
        url: `${SITE}/api/photos/photo-one/image`,
        thumbnailUrl: `${SITE}/api/photos/photo-one/thumb`,
        caption: 'A published photograph',
      },
    ]);
  });
});

describe('serving a photograph', () => {
  beforeEach(async () => {
    await storePhoto(publishedPhoto);
  });

  it('streams a published photograph with the type established at upload', async () => {
    const response = await SELF.fetch(`${SITE}/api/photos/photo-one/image`);

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toContain('immutable');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    await expect(bodyAsText(response)).resolves.toBe('original-bytes');
  });

  it('serves the thumbnail separately', async () => {
    const response = await SELF.fetch(`${SITE}/api/photos/photo-one/thumb`);

    await expect(bodyAsText(response)).resolves.toBe('thumbnail-bytes');
  });

  it('hides a photograph that is still awaiting approval', async () => {
    await storePhoto({ ...publishedPhoto, id: 'photo-pending', status: 'pending' });

    const response = await SELF.fetch(`${SITE}/api/photos/photo-pending/image`);

    // A 404 rather than a 403: refusing differently would confirm it exists.
    expect(response.status).toBe(404);
  });

  it('hides a rejected photograph', async () => {
    await storePhoto({ ...publishedPhoto, id: 'photo-rejected', status: 'rejected' });

    expect((await SELF.fetch(`${SITE}/api/photos/photo-rejected/image`)).status).toBe(404);
  });

  it('does not serve a photograph that has no metadata', async () => {
    expect((await SELF.fetch(`${SITE}/api/photos/photo-unknown/image`)).status).toBe(404);
  });

  it.each([
    ['..%2F..%2Fconfiguration%2Fsite', 'an escaped path traversal'],
    ['..', 'a parent directory'],
    ['UPPERCASE', 'characters outside the generated alphabet'],
  ])('refuses %s (%s)', async (id) => {
    const response = await SELF.fetch(`${SITE}/api/photos/${id}/image`);

    expect(response.status).toBe(404);
  });
});

describe('the router', () => {
  it('answers an unknown path with 404 rather than anything else', async () => {
    expect((await SELF.fetch(`${SITE}/api/nothing-here`)).status).toBe(404);
  });

  it('refuses an anonymous write rather than accepting it', async () => {
    const response = await SELF.fetch(`${SITE}/api/memories`, { method: 'POST', body: '{}' });

    expect(response.status).toBe(401);
  });
});
