import type { Env } from '../env';

/**
 * Verification of Cloudflare Access tokens.
 *
 * Access checks the administrator's identity at the edge and passes a signed
 * token to the Worker. The Worker verifies that token itself rather than
 * trusting the header, because a header is only a claim: anything able to reach
 * the Worker without going through Access could otherwise simply assert it.
 *
 * wrangler.toml also sets workers_dev = false so that the only route to this
 * Worker is through the zone where the Access policy applies. Belt and braces:
 * either alone would be enough, and neither is expensive.
 */

const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion';
const ACCESS_COOKIE = 'CF_Authorization';

/** Signing keys are rotated periodically, so the fetched set is short-lived. */
const KEY_CACHE_MS = 60 * 60 * 1000;

interface JsonWebKey {
  kid?: string;
  kty?: string;
  alg?: string;
  n?: string;
  e?: string;
}

interface AccessTokenPayload {
  aud?: unknown;
  iss?: unknown;
  exp?: unknown;
  nbf?: unknown;
  email?: unknown;
}

/** The signed-in administrator, once their token has been verified. */
export interface AccessIdentity {
  email: string;
}

interface CachedKeys {
  keys: Map<string, CryptoKey>;
  fetchedAt: number;
}

// Held per isolate. A cold start simply fetches again.
let cache: CachedKeys | null = null;

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function decodeJson<T>(segment: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(segment))) as T;
  } catch {
    return null;
  }
}

function issuerFor(env: Env): string | null {
  const team = env.ACCESS_TEAM_DOMAIN?.trim();
  if (team === undefined || team === '') return null;

  return `https://${team.replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
}

/**
 * Fetches the team's public signing keys, caching them for an hour.
 *
 * `alg` is pinned to RS256 when the key is imported, so a token cannot later
 * choose its own algorithm.
 */
async function signingKeys(env: Env): Promise<Map<string, CryptoKey> | null> {
  const issuer = issuerFor(env);
  if (issuer === null) return null;

  if (cache !== null && Date.now() - cache.fetchedAt < KEY_CACHE_MS) {
    return cache.keys;
  }

  let response: Response;
  try {
    response = await fetch(`${issuer}/cdn-cgi/access/certs`);
  } catch (error) {
    console.error('Could not reach the Access certificate endpoint:', error);
    return null;
  }

  if (!response.ok) {
    console.error(`Access certificate endpoint answered ${response.status}.`);
    return null;
  }

  let document: { keys?: JsonWebKey[] };
  try {
    document = (await response.json()) as { keys?: JsonWebKey[] };
  } catch {
    console.error('Access certificate endpoint returned something unreadable.');
    return null;
  }

  const keys = new Map<string, CryptoKey>();
  for (const key of document.keys ?? []) {
    if (key.kid === undefined || key.kty !== 'RSA') continue;

    try {
      keys.set(
        key.kid,
        await crypto.subtle.importKey(
          'jwk',
          { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        ),
      );
    } catch {
      // A key we cannot import is skipped rather than failing the whole set.
      console.error(`Ignoring an Access signing key that could not be imported: ${key.kid}`);
    }
  }

  if (keys.size === 0) return null;

  cache = { keys, fetchedAt: Date.now() };
  return keys;
}

function audienceMatches(audience: unknown, expected: string): boolean {
  if (typeof audience === 'string') return audience === expected;
  if (Array.isArray(audience)) return audience.includes(expected);
  return false;
}

/**
 * Verifies an Access token and returns who it belongs to, or null.
 *
 * Every check here is load-bearing:
 *
 * - the signature, against the team's published keys;
 * - `alg`, pinned to RS256, so an unsigned "alg: none" token is refused;
 * - `aud`, so a token minted for a different Access application in the same
 *   account cannot be replayed against this one;
 * - `iss`, so a token from another team is refused;
 * - `exp` and `nbf`, so an old token cannot be reused.
 */
export async function verifyAccessToken(
  env: Env,
  token: string,
): Promise<AccessIdentity | null> {
  const expectedAudience = env.ACCESS_AUD?.trim();
  const issuer = issuerFor(env);

  // Unconfigured means no administrator exists, rather than every caller being one.
  if (expectedAudience === undefined || expectedAudience === '' || issuer === null) {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [string, string, string];

  const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader);
  if (header === null || header.alg !== 'RS256' || typeof header.kid !== 'string') {
    return null;
  }

  const keys = await signingKeys(env);
  const key = keys?.get(header.kid);
  if (key === undefined) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      base64UrlDecode(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const payload = decodeJson<AccessTokenPayload>(encodedPayload);
  if (payload === null) return null;

  if (!audienceMatches(payload.aud, expectedAudience)) return null;
  if (payload.iss !== issuer) return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now) return null;

  return { email: typeof payload.email === 'string' ? payload.email : 'unknown' };
}

/** Reads the Access token from wherever Access put it. */
export function accessTokenFrom(request: Request): string | null {
  const header = request.headers.get(ACCESS_HEADER);
  if (header !== null && header.trim() !== '') return header.trim();

  const cookies = request.headers.get('Cookie');
  if (cookies === null) return null;

  for (const part of cookies.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === ACCESS_COOKIE) {
      const value = rest.join('=');
      return value === '' ? null : value;
    }
  }

  return null;
}

/** Only used by the tests, which need each case to start from a cold cache. */
export function forgetCachedKeys(): void {
  cache = null;
}
