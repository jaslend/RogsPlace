import { requireAdministrator } from '../auth/context';
import type { Role } from '../auth/session';
import type { Env } from '../env';
import { hasTrustedOrigin, json, notFound, problem } from '../http';
import { rebuildMemoriesIndex, rebuildPhotosIndex } from '../indexes';
import { isSafeId, keys, readJson } from '../storage';
import type { Memory, SiteConfig, StoredPhoto } from '../types';

interface StoredMemory extends Memory {
  status: string;
}

/** Everything an administrative request must satisfy before it does anything. */
function guard(role: Role, request: Request, env: Env): Response | null {
  const refusal = requireAdministrator(role, request, env);
  if (refusal !== null) return refusal;

  if (!hasTrustedOrigin(request, env)) {
    return problem(403, 'That request did not come from this site.', request, env);
  }

  return null;
}

async function pendingKeys(env: Env, prefix: string): Promise<string[]> {
  const found: string[] = [];
  let cursor: string | undefined;

  do {
    const listing = await env.BUCKET.list({ prefix, cursor, include: ['customMetadata'] });
    for (const object of listing.objects) {
      if (object.customMetadata?.['status'] === 'pending') found.push(object.key);
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor !== undefined);

  return found;
}

/**
 * Everything waiting to be looked at.
 *
 * Photograph URLs point at the ordinary image routes, which serve an unapproved
 * photograph only to an administrator -- so the queue can be previewed without
 * a second way of reaching the files.
 */
export async function queue(request: Request, env: Env, role: Role): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;

  const { origin } = new URL(request.url);

  const memories: Memory[] = [];
  for (const key of await pendingKeys(env, 'memories/')) {
    const stored = await readJson<StoredMemory>(env, key);
    if (stored === null) continue;
    const { status: _status, ...memory } = stored;
    memories.push(memory);
  }
  memories.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());

  const photos = [];
  for (const key of await pendingKeys(env, 'metadata/photos/')) {
    const stored = await readJson<StoredPhoto>(env, key);
    if (stored === null) continue;
    photos.push({
      id: stored.id,
      url: `${origin}/api/photos/${stored.id}/image`,
      thumbnailUrl: `${origin}/api/photos/${stored.id}/thumb`,
      ...(stored.caption === undefined ? {} : { caption: stored.caption }),
      ...(stored.uploaded === undefined ? {} : { uploaded: stored.uploaded }),
    });
  }

  return json({ memories, photos }, request, env);
}

/** Marks a memory as published and rebuilds the index that the public reads. */
export async function approveMemory(
  request: Request,
  env: Env,
  role: Role,
  id: string,
): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;
  if (!isSafeId(id)) return notFound(request, env);

  const stored = await readJson<StoredMemory>(env, keys.memory(id));
  if (stored === null) return notFound(request, env);

  await env.BUCKET.put(keys.memory(id), JSON.stringify({ ...stored, status: 'published' }), {
    customMetadata: { status: 'published' },
  });
  await rebuildMemoriesIndex(env);

  return json({ id, status: 'published' }, request, env);
}

/**
 * Removes a memory entirely.
 *
 * Rejecting deletes rather than filing away. Something an administrator did not
 * want on the memorial should not sit in the bucket indefinitely, and there is
 * no reason to keep it.
 */
export async function removeMemory(
  request: Request,
  env: Env,
  role: Role,
  id: string,
): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;
  if (!isSafeId(id)) return notFound(request, env);

  await env.BUCKET.delete(keys.memory(id));
  await rebuildMemoriesIndex(env);

  return json({ id, status: 'removed' }, request, env);
}

export async function approvePhoto(
  request: Request,
  env: Env,
  role: Role,
  id: string,
): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;
  if (!isSafeId(id)) return notFound(request, env);

  const stored = await readJson<StoredPhoto>(env, keys.photoMetadata(id));
  if (stored === null) return notFound(request, env);

  await env.BUCKET.put(
    keys.photoMetadata(id),
    JSON.stringify({ ...stored, status: 'published' }),
    { customMetadata: { status: 'published' } },
  );
  await rebuildPhotosIndex(env);

  return json({ id, status: 'published' }, request, env);
}

/** Removes a photograph and the files behind it. */
export async function removePhoto(
  request: Request,
  env: Env,
  role: Role,
  id: string,
): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;
  if (!isSafeId(id)) return notFound(request, env);

  const stored = await readJson<StoredPhoto>(env, keys.photoMetadata(id));
  if (stored !== null) {
    await env.BUCKET.delete(keys.photoOriginal(id, stored.originalExtension));
  }
  await env.BUCKET.delete(keys.photoThumbnail(id));
  await env.BUCKET.delete(keys.photoMetadata(id));
  await rebuildPhotosIndex(env);

  return json({ id, status: 'removed' }, request, env);
}

const MAX_FIELD_LENGTHS: Record<keyof SiteConfig, number> = {
  title: 120,
  name: 120,
  dateOfBirth: 40,
  dateOfDeath: 40,
  welcomeText: 2000,
  mainPhoto: 500,
};

/**
 * Replaces the memorial's details.
 *
 * Every field is required but may be empty, which is how a date that is not
 * known stays blank rather than becoming the string "undefined".
 */
export async function updateConfig(request: Request, env: Env, role: Role): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return problem(400, 'Those details could not be read.', request, env);
  }

  const config: Partial<SiteConfig> = {};
  for (const [field, maxLength] of Object.entries(MAX_FIELD_LENGTHS) as [
    keyof SiteConfig,
    number,
  ][]) {
    const value = body[field];
    if (typeof value !== 'string' || value.length > maxLength) {
      return problem(400, `Please check the ${field} field and try again.`, request, env);
    }
    config[field] = value.trim();
  }

  await env.BUCKET.put(keys.siteConfig, JSON.stringify(config));

  return json(config, request, env);
}

/**
 * Issues a new family invitation and retires the previous one.
 *
 * The token is generated here and returned exactly once; only its hash is
 * stored. Raising the version signs out everyone holding the old link, which is
 * the whole point of rotating.
 */
export async function rotateInvite(request: Request, env: Env, role: Role): Promise<Response> {
  const refusal = guard(role, request, env);
  if (refusal !== null) return refusal;

  const existing = await readJson<{ version?: number }>(env, keys.invite);
  const version = (typeof existing?.version === 'number' ? existing.version : 0) + 1;

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const tokenHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  await env.BUCKET.put(
    keys.invite,
    JSON.stringify({ tokenHash, version, rotatedAt: new Date().toISOString() }),
  );

  return json({ token, version }, request, env);
}
