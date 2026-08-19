import type { Env } from '../env';
import { json, notFound, streamed } from '../http';
import { isSafeId, keys, readJson } from '../storage';
import type { Photo, PhotoIndexEntry, StoredPhoto } from '../types';

/** Photographs never change once stored, so they can be cached hard. */
const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Turns a stored entry into the shape the gallery expects.
 *
 * URLs are built from the origin of the request rather than stored, so the same
 * bucket serves a local Worker, the test deployment and production without any
 * rewriting.
 */
function toPhoto(entry: PhotoIndexEntry, origin: string): Photo {
  return {
    id: entry.id,
    url: `${origin}/api/photos/${entry.id}/image`,
    thumbnailUrl: `${origin}/api/photos/${entry.id}/thumb`,
    ...(entry.caption === undefined ? {} : { caption: entry.caption }),
    ...(entry.uploadedBy === undefined ? {} : { uploadedBy: entry.uploadedBy }),
    ...(entry.uploaded === undefined ? {} : { uploaded: entry.uploaded }),
  };
}

export async function listPhotos(request: Request, env: Env): Promise<Response> {
  const entries = (await readJson<PhotoIndexEntry[]>(env, keys.photosIndex)) ?? [];
  const { origin } = new URL(request.url);

  return json(
    entries.map((entry) => toPhoto(entry, origin)),
    request,
    env,
    { cacheControl: 'public, max-age=30' },
  );
}

/**
 * Streams a photograph.
 *
 * Every image is served through here rather than from a public bucket, so that
 * one check governs visibility: anything not published is indistinguishable
 * from a photograph that does not exist. A pending upload is therefore never
 * reachable by guessing its URL, and there is no second copy of the rules in a
 * bucket policy to keep in step.
 */
export async function servePhoto(
  request: Request,
  env: Env,
  id: string,
  variant: 'image' | 'thumb',
): Promise<Response> {
  if (!isSafeId(id)) return notFound(request, env);

  const metadata = await readJson<StoredPhoto>(env, keys.photoMetadata(id));

  // Deliberately a 404 rather than a 403: refusing differently would confirm
  // that a photograph exists and is merely awaiting approval.
  if (metadata === null || metadata.status !== 'published') {
    return notFound(request, env);
  }

  const key =
    variant === 'thumb'
      ? keys.photoThumbnail(id)
      : keys.photoOriginal(id, metadata.originalExtension);

  const object = await env.BUCKET.get(key);
  if (object === null) return notFound(request, env);

  return streamed(object.body, request, env, {
    // The type established when the file was accepted, never one supplied now.
    contentType: variant === 'thumb' ? 'image/jpeg' : metadata.contentType,
    cacheControl: IMAGE_CACHE_CONTROL,
  });
}
