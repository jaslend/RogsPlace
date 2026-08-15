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

  /** Upload limits, mirrored by the backend once it exists. */
  upload: {
    maxFiles: 10,
    maxBytesPerFile: 20 * 1024 * 1024,
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] as const,
    acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'] as const,
  },

  /** Limits applied to the memory form. */
  memoryForm: {
    maxNameLength: 80,
    maxMessageLength: 2000,
  },

  /** How long an API request may take before it is abandoned. */
  requestTimeoutMs: 15_000,
} as const;

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
