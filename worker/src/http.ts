import type { Env } from './env';

/**
 * Applied to every response the Worker produces.
 *
 * `nosniff` matters most on the photograph routes: it stops a browser deciding
 * for itself that a stored file is HTML and rendering it in our origin.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin !== '');
}

/**
 * CORS headers for an allowed origin, and nothing at all for anyone else.
 *
 * The origin is echoed rather than wildcarded because credentialed requests
 * forbid `*`, and because a wildcard would let any page on the internet call
 * this API with the visitor's session cookie attached.
 */
export function corsHeaders(request: Request, env: Env): Record<string, string> {
  // Always vary on Origin, allowed or not, so a cache can never hand one
  // origin's response to another.
  const headers: Record<string, string> = { Vary: 'Origin' };
  const origin = request.headers.get('Origin');

  if (origin !== null && allowedOrigins(env).includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * True when a state-changing request comes from somewhere we recognise.
 *
 * SameSite=Lax already stops the session cookie riding along with a cross-site
 * form post; checking the Origin header as well is the second half of the usual
 * pair, and removes any need for CSRF tokens. Used from the first write
 * endpoint onwards.
 */
export function hasTrustedOrigin(request: Request, env: Env): boolean {
  const origin = request.headers.get('Origin');
  // Same-origin requests from some clients omit Origin entirely.
  if (origin === null) return true;
  if (allowedOrigins(env).includes(origin)) return true;
  return origin === new URL(request.url).origin;
}

interface ResponseOptions {
  status?: number;
  cacheControl?: string;
  headers?: Record<string, string>;
}

export function json(
  data: unknown,
  request: Request,
  env: Env,
  { status = 200, cacheControl = 'no-store', headers = {} }: ResponseOptions = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
      ...SECURITY_HEADERS,
      ...corsHeaders(request, env),
      ...headers,
    },
  });
}

/**
 * An error response.
 *
 * The message is written for a person, and never carries anything about what
 * went wrong internally. The browser derives its own wording from the status
 * code anyway (see src/api/apiClient.ts).
 */
export function problem(status: number, message: string, request: Request, env: Env): Response {
  return json({ message }, request, env, { status });
}

export function notFound(request: Request, env: Env): Response {
  return problem(404, 'That could not be found.', request, env);
}

/** Answers a CORS preflight. */
export function preflight(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      ...SECURITY_HEADERS,
      ...corsHeaders(request, env),
    },
  });
}

/** Wraps a streamed body (a photograph) in the same headers. */
export function streamed(
  body: ReadableStream,
  request: Request,
  env: Env,
  { contentType, cacheControl }: { contentType: string; cacheControl: string },
): Response {
  return new Response(body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
      // Stored files are only ever displayed, never treated as downloads that
      // could be opened as something else.
      'Content-Disposition': 'inline',
      ...SECURITY_HEADERS,
      ...corsHeaders(request, env),
    },
  });
}
