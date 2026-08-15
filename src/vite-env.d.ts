/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Base URL of the backend API, e.g. http://localhost:8787 during local Worker
   * development. When empty the application falls back to mock data.
   *
   * Only ever put non-secret values behind a VITE_ prefix: they are compiled
   * into the browser bundle.
   */
  readonly VITE_API_URL?: string;

  /**
   * Memorial details supplied at build time so that the real ones are never
   * committed. Anything left unset falls back to src/data/site.json.
   *
   * These are content, not secrets: they are compiled into the bundle and shown
   * on the page.
   */
  readonly VITE_SITE_TITLE?: string;
  readonly VITE_SITE_NAME?: string;
  /** ISO 8601, e.g. 1938-04-17. */
  readonly VITE_SITE_DATE_OF_BIRTH?: string;
  /** ISO 8601, e.g. 2026-02-03. */
  readonly VITE_SITE_DATE_OF_DEATH?: string;
  readonly VITE_SITE_WELCOME_TEXT?: string;
  /** Path relative to the site root, or an absolute URL. */
  readonly VITE_SITE_MAIN_PHOTO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
