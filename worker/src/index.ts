import { resolveRole } from './auth/context';
import type { Role } from './auth/session';
import type { Env } from './env';
import { json, notFound, preflight, problem } from './http';
import {
  approveMemory,
  approvePhoto,
  queue,
  removeMemory,
  removePhoto,
  rotateInvite,
  updateConfig,
} from './routes/admin';
import { logout, redeem, session } from './routes/auth';
import { getConfig } from './routes/config';
import { createMemory, listMemories } from './routes/memories';
import { createPhoto, listPhotos, servePhoto } from './routes/photos';

const PHOTO_FILE = /^\/api\/photos\/([^/]+)\/(image|thumb)$/;
const ADMIN_MEMORY = /^\/api\/admin\/memories\/([^/]+)\/(approve|remove)$/;
const ADMIN_PHOTO = /^\/api\/admin\/photos\/([^/]+)\/(approve|remove)$/;

/**
 * Every route in the application.
 *
 * Nothing is reachable unless it is matched here, and anything not matched is a
 * 404 -- so a new route cannot be exposed by accident. Authorisation is not
 * granted by pattern either: each handler is passed the caller's role and
 * decides for itself, which means a route added later is closed until somebody
 * opens it deliberately.
 */
async function route(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url);
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

  // Everything below depends on who is asking.
  const role: Role = await resolveRole(request, env);

  const photoFile = PHOTO_FILE.exec(pathname);
  if (photoFile !== null && method === 'GET') {
    return servePhoto(request, env, photoFile[1]!, photoFile[2] as 'image' | 'thumb', role);
  }

  // --- Contributions, which land in the moderation queue --------------------

  if (pathname === '/api/memories' && method === 'POST') {
    return createMemory(request, env, role);
  }

  if (pathname === '/api/photos' && method === 'POST') {
    return createPhoto(request, env, role);
  }

  // --- Administration -------------------------------------------------------

  if (pathname === '/api/admin/queue' && method === 'GET') {
    return queue(request, env, role);
  }

  const adminMemory = ADMIN_MEMORY.exec(pathname);
  if (adminMemory !== null && method === 'POST') {
    const [, id, action] = adminMemory as unknown as [string, string, string];
    return action === 'approve'
      ? approveMemory(request, env, role, id)
      : removeMemory(request, env, role, id);
  }

  const adminPhoto = ADMIN_PHOTO.exec(pathname);
  if (adminPhoto !== null && method === 'POST') {
    const [, id, action] = adminPhoto as unknown as [string, string, string];
    return action === 'approve'
      ? approvePhoto(request, env, role, id)
      : removePhoto(request, env, role, id);
  }

  if (pathname === '/api/config' && method === 'PUT') {
    return updateConfig(request, env, role);
  }

  if (pathname === '/api/admin/invite/rotate' && method === 'POST') {
    return rotateInvite(request, env, role);
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
