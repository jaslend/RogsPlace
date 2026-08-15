/**
 * A written memory contributed by a visitor.
 *
 * Each memory will eventually be stored as its own object in R2
 * (memories/<memory-id>.json) so that concurrent submissions cannot overwrite
 * one another.
 */
export interface Memory {
  /** Server-generated identifier. Never supplied by the browser. */
  id: string;
  /** Name of the contributor. */
  name: string;
  /** The memory itself. */
  message: string;
  /** ISO 8601 timestamp of when the memory was created. */
  created: string;
  /** Optional identifier of an associated photograph. */
  photoId?: string;
}

/** The fields a visitor supplies when submitting a memory. */
export interface NewMemory {
  name: string;
  message: string;
  photoId?: string;
}
