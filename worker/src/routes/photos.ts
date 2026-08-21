import { uploadLimits } from '../../../src/config/limits';
import { requireContributor } from '../auth/context';
import type { Role } from '../auth/session';
import type { Env } from '../env';
import { hasTrustedOrigin, json, notFound, problem, streamed } from '../http';
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
  role: Role,
): Promise<Response> {
  if (!isSafeId(id)) return notFound(request, env);

  const metadata = await readJson<StoredPhoto>(env, keys.photoMetadata(id));

  // Deliberately a 404 rather than a 403: refusing differently would confirm
  // that a photograph exists and is merely awaiting approval. An administrator
  // sees everything, because they have to look at it to moderate it.
  const visible = metadata !== null && (metadata.status === 'published' || role === 'administrator');
  if (metadata === null || !visible) {
    return notFound(request, env);
  }

  const original = keys.photoOriginal(id, metadata.originalExtension);

  // Thumbnails are generated in the browser and uploaded with the photograph.
  // Anything stored before that, or uploaded without one, still has to be
  // servable, so a missing thumbnail falls back to the full photograph rather
  // than failing.
  let object = variant === 'thumb' ? await env.BUCKET.get(keys.photoThumbnail(id)) : null;
  const servingOriginal = object === null;
  if (object === null) object = await env.BUCKET.get(original);
  if (object === null) return notFound(request, env);

  return streamed(object.body, request, env, {
    // The type established when the file was accepted, never one supplied now.
    contentType: servingOriginal ? metadata.contentType : 'image/jpeg',
    cacheControl: IMAGE_CACHE_CONTROL,
  });
}

/** Magic numbers, because a browser's idea of a file's type is only a claim. */
const SIGNATURES: ReadonlyArray<{
  mime: string;
  extension: string;
  matches: (bytes: Uint8Array) => boolean;
}> = [
  {
    mime: 'image/jpeg',
    extension: 'jpg',
    matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: 'image/png',
    extension: 'png',
    matches: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d &&
      b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: 'image/webp',
    extension: 'webp',
    matches: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/**
 * Identifies a file by its contents.
 *
 * Nothing here consults the declared MIME type or the filename. An SVG, an HTML
 * page or an executable renamed to .jpg matches no signature and is refused --
 * which is the whole point, since those are what turn an upload form into a way
 * to serve script from this origin.
 */
function sniffImage(bytes: Uint8Array): { mime: string; extension: string } | null {
  if (bytes.length < 12) return null;

  const match = SIGNATURES.find((signature) => signature.matches(bytes));

  return match === undefined ? null : { mime: match.mime, extension: match.extension };
}

/** Distinguishes "no thumbnail was sent" from "one was, and it is not usable". */
const INVALID_THUMBNAIL = Symbol('invalid thumbnail');

/**
 * Reads the thumbnail field, if the upload carried one.
 *
 * Returns null when the field is absent, the bytes when they sniff as a JPEG,
 * and INVALID_THUMBNAIL when something was sent that is not one. The size cap is
 * a fraction of the photograph's: a thumbnail larger than that is not a
 * thumbnail, whatever it claims to be.
 */
async function readThumbnail(form: FormData): Promise<Uint8Array | null | typeof INVALID_THUMBNAIL> {
  const field = form.get('thumbnail');
  if (field === null) return null;
  if (!(field instanceof File)) return INVALID_THUMBNAIL;

  if (field.size === 0 || field.size > uploadLimits.maxUploadBytes / 8) {
    return INVALID_THUMBNAIL;
  }

  const bytes = new Uint8Array(await field.arrayBuffer());
  const kind = sniffImage(bytes);

  return kind !== null && kind.mime === 'image/jpeg' ? bytes : INVALID_THUMBNAIL;
}

/**
 * Accepts one photograph from a contributor, into the moderation queue.
 *
 * One photograph per request keeps memory bounded: a Worker has far less of it
 * than ten twenty-megabyte files would need, and uploading them one at a time
 * also means one failure does not lose the rest. The browser's photoService
 * loops, so the page still offers a single upload button.
 */
export async function createPhoto(request: Request, env: Env, role: Role): Promise<Response> {
  const refusal = requireContributor(role, request, env);
  if (refusal !== null) return refusal;

  if (!hasTrustedOrigin(request, env)) {
    return problem(403, 'That request did not come from this site.', request, env);
  }

  // Refuse an oversized body before reading any of it into memory. The browser
  // downscales before uploading, so a body anywhere near this ceiling did not
  // come from the site's own upload page.
  const declaredLength = Number(request.headers.get('Content-Length') ?? '0');
  if (declaredLength > uploadLimits.maxUploadBytes + 1024 * 1024) {
    return problem(413, 'That photograph is too large.', request, env);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return problem(400, 'That upload could not be read.', request, env);
  }

  const file = form.get('photo');
  if (!(file instanceof File)) {
    return problem(400, 'No photograph was included in that upload.', request, env);
  }

  if (file.size === 0) return problem(400, 'That file is empty.', request, env);
  if (file.size > uploadLimits.maxUploadBytes) {
    return problem(413, 'That photograph is too large.', request, env);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (kind === null) {
    return problem(
      400,
      'That file is not a JPEG, PNG or WebP photograph. Please choose another.',
      request,
      env,
    );
  }

  // The thumbnail the browser generated alongside the photograph. Optional, so
  // that an upload without one still succeeds -- serving falls back to the full
  // photograph -- but sniffed just as hard when it is there, because it is
  // untrusted bytes that will be served back to browsers.
  //
  // JPEG only: the thumbnail is stored under a .jpg key and served with that
  // type, so accepting another format would put the two out of step.
  const thumbnail = await readThumbnail(form);
  if (thumbnail === INVALID_THUMBNAIL) {
    return problem(
      400,
      'The thumbnail sent with that photograph could not be read.',
      request,
      env,
    );
  }

  // The Worker names the object. The filename the browser sent is never used to
  // build a storage key -- at most it could become a caption later.
  const id = crypto.randomUUID();
  const metadata: StoredPhoto = {
    id,
    status: 'pending',
    originalExtension: kind.extension,
    contentType: kind.mime,
  };

  // No status on the original: the metadata object is the single source of
  // truth for it, and rewriting the stored object to change a label would be
  // wasteful.
  await env.BUCKET.put(keys.photoOriginal(id, kind.extension), bytes);
  if (thumbnail !== null) await env.BUCKET.put(keys.photoThumbnail(id), thumbnail);
  await env.BUCKET.put(keys.photoMetadata(id), JSON.stringify(metadata), {
    customMetadata: { status: 'pending' },
  });

  return json({ uploadedCount: 1, id }, request, env, { status: 202 });
}
