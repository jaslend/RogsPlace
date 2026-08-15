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
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
