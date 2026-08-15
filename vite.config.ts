import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Base path handling.
 *
 * - Local development and Cloudflare Pages serve the site from the domain root,
 *   so the default is "/".
 * - GitHub Pages serves a project site from "/<repository-name>/", so the
 *   deployment workflow sets BASE_PATH (see .github/workflows/deploy-pages.yml).
 *
 * The resolved value is exposed to application code as import.meta.env.BASE_URL
 * and is read in exactly one place: src/config/appConfig.ts.
 */
const basePath = normaliseBasePath(process.env.BASE_PATH ?? '/');

function normaliseBasePath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === '/') return '/';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

/**
 * GitHub Pages has no SPA rewrite rule: a request for /rogsplace/photos looks
 * for a file that does not exist and falls through to 404.html. Serving a copy
 * of index.html from there hands the request to the React application with the
 * URL still intact, so deep links work without redirect trickery.
 *
 * Cloudflare Pages performs a real SPA rewrite, so the extra file is simply
 * unused there -- nothing needs to change when the site moves.
 */
function githubPagesSpaFallback(): Plugin {
  let outDir = 'dist';
  return {
    name: 'rogsplace:github-pages-spa-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const indexHtml = resolve(outDir, 'index.html');
      if (existsSync(indexHtml)) {
        copyFileSync(indexHtml, resolve(outDir, '404.html'));
      }
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [react(), githubPagesSpaFallback()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // CSS is not processed for tests: jsdom does not evaluate media queries, so
    // applying the real stylesheet would treat the mobile-collapsed navigation
    // as hidden on every screen size.
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
