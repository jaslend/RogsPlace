import type { Env } from './env';
import { json, notFound, preflight, problem } from './http';
import { getConfig } from './routes/config';
import { listMemories } from './routes/memories';
import { listPhotos, servePhoto } from './routes/photos';

const PHOTO_FILE = /^\/api\/photos\/([^/]+)\/(image|thumb)$/;

/**
 * Every route in the application.
 *
 * Nothing is reachable unless it is matched here, and anything not matched is a
 * 404 -- so a new route cannot be exposed by accident. When the write endpoints
 * arrive, each one carries its own authorisation check: this router deliberately
 * does not grant anything by pattern.
 */
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  if (method === 'OPTIONS') return preflight(request, env);

  if (pathname === '/api/health') {
    return json({ status: 'ok' }, request, env);
  }

  if (pathname === '/api/config' && method === 'GET') {
    return getConfig(request, env);
  }

  if (pathname === '/api/memories' && method === 'GET') {
    return listMemories(request, env);
  }

  if (pathname === '/api/photos' && method === 'GET') {
    return listPhotos(request, env);
  }

  const photoFile = PHOTO_FILE.exec(pathname);
  if (photoFile !== null && method === 'GET') {
    return servePhoto(request, env, photoFile[1]!, photoFile[2] as 'image' | 'thumb');
  }

  return notFound(request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await route(request, env);
    } catch (error) {
      // Developers get the detail in the logs; the visitor gets an apology.
      console.error('Unhandled error while serving a request:', error);
      return problem(500, 'Something went wrong. Please try again shortly.', request, env);
    }
  },
};
