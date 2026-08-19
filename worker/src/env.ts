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
  /**
   * Cloudflare Access team domain, e.g. "yourteam.cloudflareaccess.com".
   * Not a secret: it appears in every sign-in URL.
   */
  ACCESS_TEAM_DOMAIN?: string;
  /**
   * Audience tag of the Access application guarding the admin routes. Not a
   * secret either -- it identifies the application, it does not authorise
   * anything on its own.
   *
   * Both are optional in the type so that a Worker without them fails closed:
   * no administrator exists at all until Access is configured.
   */
  ACCESS_AUD?: string;
}
