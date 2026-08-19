import type { Env } from '../env';

/** Who is making a request. */
export type Role = 'visitor' | 'contributor' | 'administrator';

export interface Session {
  role: Exclude<Role, 'visitor'>;
  /** Invite generation this session was issued against. */
  ver: number;
  /** Expiry, in seconds since the epoch. */
  exp: number;
}

export const SESSION_COOKIE = 'rp_session';
const SESSION_LIFETIME_SECONDS = 30 * 24 * 60 * 60;

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * The signing key, or null when none is configured.
 *
 * A Worker deployed without SESSION_SIGNING_KEY must refuse to issue or accept
 * sessions rather than fall back to something predictable: failing closed here
 * turns a misconfiguration into "nobody can sign in" instead of "anybody can".
 */
async function signingKey(env: Env): Promise<CryptoKey | null> {
  const secret = env.SESSION_SIGNING_KEY?.trim();
  if (secret === undefined || secret === '') {
    console.error('SESSION_SIGNING_KEY is not configured; sessions are disabled.');
    return null;
  }

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Issues a signed token for a role. Returns null when signing is unavailable. */
export async function createSessionToken(
  env: Env,
  role: Session['role'],
  version: number,
): Promise<string | null> {
  const key = await signingKey(env);
  if (key === null) return null;

  const session: Session = {
    role,
    ver: version,
    exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
  };

  const payload = base64UrlEncode(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));

  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/**
 * Verifies a token and returns the session it carries, or null.
 *
 * `crypto.subtle.verify` does the comparison, so there is no hand-written
 * equality check on the signature to get wrong.
 */
export async function readSessionToken(env: Env, token: string): Promise<Session | null> {
  const key = await signingKey(env);
  if (key === null) return null;

  const separator = token.indexOf('.');
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(payload),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let session: Session;
  try {
    session = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as Session;
  } catch {
    return null;
  }

  if (session.role !== 'contributor' && session.role !== 'administrator') return null;
  if (typeof session.exp !== 'number' || session.exp * 1000 <= Date.now()) return null;
  if (typeof session.ver !== 'number') return null;

  return session;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (header === null) return null;

  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }

  return null;
}

/**
 * HttpOnly keeps the cookie away from JavaScript, so an injected script cannot
 * read it. SameSite=Lax stops it riding along with a cross-site form post,
 * which -- together with the Origin check on every write -- is what removes the
 * need for CSRF tokens.
 */
export function sessionCookie(token: string): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_LIFETIME_SECONDS}`,
  ].join('; ');
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}
