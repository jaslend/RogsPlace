import type { Env } from './env';
import { keys, readJson } from './storage';
import type { Memory, PhotoIndexEntry, StoredPhoto } from './types';

/**
 * The published indexes are rebuilt from scratch rather than edited in place.
 *
 * Rebuilding is a handful of reads at this scale, and it cannot drift: if an
 * object and the index ever disagree, the next approval reconciles them. An
 * incremental update would be cheaper and would eventually be wrong.
 *
 * This is only ever run by an administrator approving or removing something --
 * one person, acting deliberately -- so two rebuilds cannot race. Contributions
 * never touch it, which is what keeps concurrent submissions safe.
 */

interface StoredMemory extends Memory {
  status: string;
}

/** Keys under a prefix whose stored status is 'published'. */
async function publishedKeys(env: Env, prefix: string): Promise<string[]> {
  const found: string[] = [];
  let cursor: string | undefined;

  do {
    const listing = await env.BUCKET.list({ prefix, cursor, include: ['customMetadata'] });

    for (const object of listing.objects) {
      if (object.customMetadata?.['status'] === 'published') found.push(object.key);
    }

    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor !== undefined);

  return found;
}

export async function rebuildMemoriesIndex(env: Env): Promise<void> {
  const published: Memory[] = [];

  for (const key of await publishedKeys(env, 'memories/')) {
    const stored = await readJson<StoredMemory>(env, key);
    if (stored === null) continue;

    const { status: _status, ...memory } = stored;
    published.push(memory);
  }

  published.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  await env.BUCKET.put(keys.memoriesIndex, JSON.stringify(published));
}

export async function rebuildPhotosIndex(env: Env): Promise<void> {
  const published: PhotoIndexEntry[] = [];

  for (const key of await publishedKeys(env, 'metadata/photos/')) {
    const stored = await readJson<StoredPhoto>(env, key);
    if (stored === null) continue;

    published.push({
      id: stored.id,
      ...(stored.caption === undefined ? {} : { caption: stored.caption }),
      ...(stored.uploadedBy === undefined ? {} : { uploadedBy: stored.uploadedBy }),
      ...(stored.uploaded === undefined ? {} : { uploaded: stored.uploaded }),
    });
  }

  published.sort((a, b) => {
    const first = a.uploaded === undefined ? 0 : new Date(a.uploaded).getTime();
    const second = b.uploaded === undefined ? 0 : new Date(b.uploaded).getTime();
    return second - first;
  });

  await env.BUCKET.put(keys.photosIndex, JSON.stringify(published));
}
