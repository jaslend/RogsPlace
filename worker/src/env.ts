/** Bindings and variables declared in wrangler.toml. */
export interface Env {
  /** R2 bucket holding the memorial's configuration, memories and photographs. */
  BUCKET: R2Bucket;
  /** Comma-separated list of origins allowed to make credentialed requests. */
  ALLOWED_ORIGINS: string;
}
