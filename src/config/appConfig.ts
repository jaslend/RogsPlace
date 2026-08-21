/**
 * The single place in the application that reads Vite environment variables.
 *
 * Everything else imports `appConfig`, so switching between mock data, a local
 * Worker, a test Worker and production is a configuration change rather than a
 * code change.
 *
 * Anything prefixed VITE_ is embedded in the JavaScript bundle and is therefore
 * public. Never put secrets here.
 */

import type { SiteConfig } from '../models/SiteConfig';
import { memoryFormLimits, uploadLimits } from './limits';

function stripTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

const rawApiUrl = (import.meta.env.VITE_API_URL ?? '').trim();

/** Vite substitutes the configured `base` here; it always ends with "/". */
const baseUrl = import.meta.env.BASE_URL || '/';

export const appConfig = {
  /** API root without a trailing slash, e.g. "http://localhost:8787". */
  apiBaseUrl: stripTrailingSlash(rawApiUrl),

  /**
   * True while no backend is configured. Services fall back to local JSON and
   * simulated writes so the site is fully usable before the Worker exists.
   */
  useMockData: rawApiUrl === '',

  /** Where the site is served from, e.g. "/" locally or "/RogsPlace/" on GitHub Pages. */
  baseUrl,

  /** React Router basename: as above but without the trailing slash. */
  routerBasename: stripTrailingSlash(baseUrl) || '/',

  /** Upload limits. The Worker enforces the same numbers -- see config/limits.ts. */
  upload: uploadLimits,

  /** Limits applied to the memory form, likewise shared with the Worker. */
  memoryForm: memoryFormLimits,

  /** How long an API request may take before it is abandoned. */
  requestTimeoutMs: 15_000,
} as const;

/** Undefined for a variable that is unset, empty, or only whitespace. */
function contentValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === '' ? undefined : trimmed;
}

const overrides: Partial<SiteConfig> = {};

function addOverride(key: keyof SiteConfig, value: string | undefined): void {
  if (value !== undefined) overrides[key] = value;
}

addOverride('title', contentValue(import.meta.env.VITE_SITE_TITLE));
addOverride('name', contentValue(import.meta.env.VITE_SITE_NAME));
addOverride('dateOfBirth', contentValue(import.meta.env.VITE_SITE_DATE_OF_BIRTH));
addOverride('dateOfDeath', contentValue(import.meta.env.VITE_SITE_DATE_OF_DEATH));
addOverride('welcomeText', contentValue(import.meta.env.VITE_SITE_WELCOME_TEXT));
addOverride('mainPhoto', contentValue(import.meta.env.VITE_SITE_MAIN_PHOTO));

/**
 * Memorial details supplied at build time rather than committed.
 *
 * This keeps the real details of the person being remembered out of the
 * repository, so a clone or a fork gets only the placeholder content in
 * src/data/site.json. In the deployment workflow the values come from GitHub
 * Actions *variables* (never secrets): they end up in the JavaScript bundle and
 * on the page, exactly like the rest of the site's content.
 *
 * A variable that is unset or empty is ignored, so the placeholder shows
 * through and blank dates stay blank.
 */
export const siteContentOverrides: Readonly<Partial<SiteConfig>> = overrides;

/**
 * Resolves a stored asset path against the application base path.
 *
 * Absolute URLs (future R2 / Worker URLs) are returned untouched, so gallery
 * data can move from local placeholders to remote storage without any change
 * to the components that render it.
 */
export function resolveAssetUrl(path: string): string {
  if (path === '') return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  return `${appConfig.baseUrl}${path.replace(/^\.?\//, '')}`;
}
