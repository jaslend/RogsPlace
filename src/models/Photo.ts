/**
 * A photograph in the gallery.
 *
 * `url` and `thumbnailUrl` may be absolute (a future Worker/R2 URL) or relative
 * to the application base path (the placeholder assets used during initial
 * development). Use `resolveAssetUrl` from src/config/appConfig.ts to turn one
 * into a URL the browser can request.
 */
export interface Photo {
  /** Server-generated identifier. Never supplied by the browser. */
  id: string;
  /** Full-size image location. */
  url: string;
  /** Thumbnail image location, used by the gallery grid. */
  thumbnailUrl: string;
  /** Optional caption shown in the gallery and full-screen view. */
  caption?: string;
  /** Optional name of the contributor. */
  uploadedBy?: string;
  /** Optional ISO 8601 upload timestamp. */
  uploaded?: string;
}

/** Outcome of an upload attempt, reported back to the upload page. */
export interface PhotoUploadResult {
  /** Number of files accepted by the backend. */
  uploadedCount: number;
}
