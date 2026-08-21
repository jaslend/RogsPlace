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
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.toml' },
      miniflare: {
        // The real key is a Worker secret set with `wrangler secret put`, and
        // never lives in the repository. Tests need a deterministic one, so it
        // is supplied here rather than from a .dev.vars file that CI would not
        // have.
        bindings: {
          SESSION_SIGNING_KEY: 'test-signing-key-not-used-anywhere-real',
          // Access configuration. The team domain is never contacted for real:
          // the tests stub the certificate endpoint with a keypair they own.
          ACCESS_TEAM_DOMAIN: 'rogsplace.cloudflareaccess.com',
          ACCESS_AUD: 'test-access-audience',
        },
      },
    }),
  ],
  test: {
    include: ['worker/test/**/*.test.ts'],
  },
});
