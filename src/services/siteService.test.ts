import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import placeholder from '../data/site.json';

/**
 * `appConfig` reads the environment when it is first imported, so each test
 * resets the module registry and imports the service again.
 */
async function loadSiteService() {
  vi.resetModules();
  const { siteService } = await import('./siteService');
  return siteService;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the site service, with no build-time details supplied', () => {
  it('falls back to the committed placeholder content', async () => {
    const service = await loadSiteService();

    expect(await service.getSiteConfig()).toEqual(placeholder);
  });
});

describe('the site service, with build-time details supplied', () => {
  it('uses a supplied name in place of the placeholder', async () => {
    vi.stubEnv('VITE_SITE_NAME', 'Someone Remembered');

    const config = await (await loadSiteService()).getSiteConfig();

    expect(config.name).toBe('Someone Remembered');
    // Everything else still comes from the placeholder.
    expect(config.title).toBe(placeholder.title);
  });

  it('accepts every field', async () => {
    vi.stubEnv('VITE_SITE_TITLE', 'In Loving Memory Of');
    vi.stubEnv('VITE_SITE_NAME', 'Someone Remembered');
    vi.stubEnv('VITE_SITE_DATE_OF_BIRTH', '1938-04-17');
    vi.stubEnv('VITE_SITE_DATE_OF_DEATH', '2026-02-03');
    vi.stubEnv('VITE_SITE_WELCOME_TEXT', 'A few words of welcome.');
    vi.stubEnv('VITE_SITE_MAIN_PHOTO', 'photos/main.jpg');

    expect(await (await loadSiteService()).getSiteConfig()).toEqual({
      title: 'In Loving Memory Of',
      name: 'Someone Remembered',
      dateOfBirth: '1938-04-17',
      dateOfDeath: '2026-02-03',
      welcomeText: 'A few words of welcome.',
      mainPhoto: 'photos/main.jpg',
    });
  });

  it('ignores an empty variable so that blank dates stay blank', async () => {
    vi.stubEnv('VITE_SITE_DATE_OF_BIRTH', '');
    vi.stubEnv('VITE_SITE_DATE_OF_DEATH', '   ');

    const config = await (await loadSiteService()).getSiteConfig();

    expect(config.dateOfBirth).toBe('');
    expect(config.dateOfDeath).toBe('');
  });

  it('trims surrounding whitespace', async () => {
    vi.stubEnv('VITE_SITE_NAME', '  Someone Remembered  ');

    expect((await (await loadSiteService()).getSiteConfig()).name).toBe('Someone Remembered');
  });
});
