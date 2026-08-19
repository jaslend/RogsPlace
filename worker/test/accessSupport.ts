import { vi } from 'vitest';
import { forgetCachedKeys } from '../src/auth/access';

/**
 * A keypair the tests own, standing in for Cloudflare's.
 *
 * Access publishes its public keys at a well-known URL and signs tokens with
 * the matching private key. Generating our own pair and stubbing that URL lets
 * the tests exercise the real verification path -- signature, audience, issuer,
 * expiry -- rather than a version of it with the checks turned off.
 */
export const ISSUER = 'https://rogsplace.cloudflareaccess.com';
export const AUDIENCE = 'test-access-audience';
export const KEY_ID = 'test-key';

let signingKey: CryptoKey;
let otherSigningKey: CryptoKey;
let publishedKeys: unknown;

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function encodeSegment(value: object): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

const RSA = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
} as const;

/** Generates the keypair and stubs the certificate endpoint. Call once per file. */
export async function useFakeAccessKeys(): Promise<void> {
  // generateKey is typed as returning a key or a pair; RSA always gives a pair.
  const pair = (await crypto.subtle.generateKey(RSA, true, ['sign', 'verify'])) as CryptoKeyPair;
  const other = (await crypto.subtle.generateKey(RSA, true, ['sign', 'verify'])) as CryptoKeyPair;

  signingKey = pair.privateKey;
  otherSigningKey = other.privateKey;

  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  publishedKeys = { keys: [{ ...jwk, kid: KEY_ID, alg: 'RS256' }] };

  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === `${ISSUER}/cdn-cgi/access/certs`) {
      return new Response(JSON.stringify(publishedKeys), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected outbound request in a test: ${url}`);
  });
}

/** Keys are cached for an hour inside the Worker, so each test starts cold. */
export function resetAccessKeys(): void {
  forgetCachedKeys();
}

interface TokenOptions {
  aud?: unknown;
  iss?: string;
  exp?: number;
  nbf?: number;
  email?: string;
  kid?: string;
  alg?: string;
  /** Sign with a key Access does not publish. */
  wrongKey?: boolean;
}

/** Mints an Access token, valid by default and broken in exactly one way on request. */
export async function accessToken(options: TokenOptions = {}): Promise<string> {
  const header = encodeSegment({ alg: options.alg ?? 'RS256', kid: options.kid ?? KEY_ID });
  const payload = encodeSegment({
    aud: options.aud ?? [AUDIENCE],
    iss: options.iss ?? ISSUER,
    exp: options.exp ?? Math.floor(Date.now() / 1000) + 3600,
    ...(options.nbf === undefined ? {} : { nbf: options.nbf }),
    email: options.email ?? 'admin@example.com',
  });

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    options.wrongKey === true ? otherSigningKey : signingKey,
    new TextEncoder().encode(`${header}.${payload}`),
  );

  return `${header}.${payload}.${base64Url(new Uint8Array(signature))}`;
}

/** An unsigned token claiming not to need a signature. */
export function unsignedToken(): string {
  const header = encodeSegment({ alg: 'none', kid: KEY_ID });
  const payload = encodeSegment({
    aud: [AUDIENCE],
    iss: ISSUER,
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'attacker@example.com',
  });

  return `${header}.${payload}.`;
}

/** Headers as Cloudflare Access would present them to the Worker. */
export function asAdministrator(token: string, origin = 'https://rogsplace.test') {
  return { Origin: origin, 'Cf-Access-Jwt-Assertion': token };
}
