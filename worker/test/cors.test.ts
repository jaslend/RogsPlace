import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

const SITE = 'https://rogsplace.test';
const ALLOWED = 'http://localhost:5173';
const HOSTILE = 'https://not-rogsplace.example';

/**
 * CORS is the control that decides which other websites may call this API with
 * the visitor's cookie attached, so the negative cases matter more than the
 * positive one.
 */
describe('cross-origin access', () => {
  it('allows a configured origin, with credentials', async () => {
    const response = await SELF.fetch(`${SITE}/api/config`, { headers: { Origin: ALLOWED } });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('refuses an origin that is not configured', async () => {
    const response = await SELF.fetch(`${SITE}/api/config`, { headers: { Origin: HOSTILE } });

    // The request still succeeds -- the browser is what enforces CORS -- but
    // without these headers it cannot read the response or send credentials.
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('never answers with a wildcard, which would defeat the point', async () => {
    const response = await SELF.fetch(`${SITE}/api/config`, { headers: { Origin: HOSTILE } });

    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });

  it('varies on Origin so a cache cannot serve one origin the other reply', async () => {
    for (const origin of [ALLOWED, HOSTILE]) {
      const response = await SELF.fetch(`${SITE}/api/config`, { headers: { Origin: origin } });
      expect(response.headers.get('Vary')).toContain('Origin');
    }
  });

  it('answers a preflight for an allowed origin', async () => {
    const response = await SELF.fetch(`${SITE}/api/memories`, {
      method: 'OPTIONS',
      headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'POST' },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('gives a preflight from an unknown origin nothing to work with', async () => {
    const response = await SELF.fetch(`${SITE}/api/memories`, {
      method: 'OPTIONS',
      headers: { Origin: HOSTILE, 'Access-Control-Request-Method': 'POST' },
    });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
