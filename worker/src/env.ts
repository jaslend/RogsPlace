/** Bindings and variables declared in wrangler.toml. */
export interface Env {
  /** R2 bucket holding the memorial's configuration, memories and photographs. */
  BUCKET: R2Bucket;
  /** Comma-separated list of origins allowed to make credentialed requests. */
  ALLOWED_ORIGINS: string;
  /**
   * Key used to sign session cookies. Set with `wrangler secret put`, and in
   * .dev.vars for local development -- never in wrangler.toml, which is
   * committed.
   *
   * Optional in the type so that a Worker missing it fails closed rather than
   * failing to start: see worker/src/auth/session.ts.
   */
  SESSION_SIGNING_KEY?: string;
}
