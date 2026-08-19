import placeholder from '../../../src/data/site.json';
import type { Env } from '../env';
import { json } from '../http';
import { keys, readJson } from '../storage';
import type { SiteConfig } from '../types';

/**
 * The memorial's details.
 *
 * Served from R2 so that an administrator can edit them without a rebuild. A
 * bucket that has not been seeded yet falls back to the placeholder committed
 * in src/data/site.json, so a fresh deployment renders rather than erroring.
 */
export async function getConfig(request: Request, env: Env): Promise<Response> {
  const stored = await readJson<SiteConfig>(env, keys.siteConfig);

  return json(stored ?? (placeholder as SiteConfig), request, env, {
    cacheControl: 'public, max-age=30',
  });
}
