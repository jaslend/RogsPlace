import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * The Worker's tests run in the real Workers runtime with a real (in-memory) R2
 * bucket, rather than against mocks. Authorisation is the kind of thing that
 * has to be tested against the runtime that will actually enforce it.
 *
 * Bindings and variables come from wrangler.toml, so the tests exercise the
 * same configuration that is deployed.
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.toml' } })],
  test: {
    include: ['worker/test/**/*.test.ts'],
  },
});
