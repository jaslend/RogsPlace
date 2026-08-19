import type { Env as WorkerEnv } from '../src/env';

/**
 * Tells `cloudflare:test` what the `env` it hands to a test contains.
 *
 * The pool types `env` as `Cloudflare.Env`, so the Worker's own bindings are
 * declared into that namespace rather than duplicated here.
 */
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}

export {};
