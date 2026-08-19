import { resolveRole } from './auth/context';
import type { Env } from './env';
import { json, notFound, preflight, problem } from './http';
import { logout, redeem, session } from './routes/auth';
import { getConfig } from './routes/config';
import { createMemory, listMemories } from './routes/memories';
import { createPhoto, listPhotos, servePhoto } from './routes/photos';

const PHOTO_FILE = /^\/api\/photos\/([^/]+)\/(image|thumb)$/;

/**
 * Every route in the application.
 *
 * Nothing is reachable unless it is matched here, and anything not matched is a
 * 404 -- so a new route cannot be exposed by accident. Authorisation is not
 * granted by pattern either: each write handler is passed the caller's role and
 * decides for itself, which means a route added later is closed until somebody
 * opens it deliberately.
 */
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const { pathname } = url;
  const { method } = request;

  if (method === 'OPTIONS') return preflight(request, env);

  if (pathname === '/api/health') {
    return json({ status: 'ok' }, request, env);
  }

  // --- Public reads ---------------------------------------------------------

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

  // --- Sessions -------------------------------------------------------------

  if (pathname === '/api/auth/invite' && method === 'POST') {
    return redeem(request, env);
  }

  if (pathname === '/api/auth/session' && method === 'GET') {
    return session(request, env);
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return logout(request, env);
  }

  // --- Contributions, which land in the moderation queue --------------------

  if (pathname === '/api/memories' && method === 'POST') {
    return createMemory(request, env, await resolveRole(request, env));
  }

  if (pathname === '/api/photos' && method === 'POST') {
    return createPhoto(request, env, await resolveRole(request, env));
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
