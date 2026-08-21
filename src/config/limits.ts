/**
 * Validation limits shared by the browser and the Worker.
 *
 * This module deliberately reads no environment and imports nothing, so the
 * Worker can use it as-is. The browser checks are a courtesy; the Worker's are
 * the ones that matter -- and they have to be the same numbers, or a file the
 * page accepted would be rejected after the visitor waited for the upload.
 */

export const uploadLimits = {
  maxFiles: 10,

  /**
   * The largest file a visitor may choose from their device.
   *
   * Nothing this size is ever sent: the browser downscales and re-encodes first
   * (see utils/preparePhoto), so this bounds what has to be decoded locally
   * rather than what crosses the network.
   */
  maxBytesPerFile: 20 * 1024 * 1024,

  /**
   * The largest body the Worker will accept for one photograph.
   *
   * A 2560px JPEG is usually well under a megabyte, so this is mostly headroom
   * for an unusually detailed one. It matters because a Worker on the free plan
   * gets 10ms of CPU per request: reading a 20MB upload into memory to sniff and
   * store it can exceed that, and the symptom is large photographs failing while
   * small ones work. Keeping the body small is what avoids the problem, rather
   * than a larger CPU budget.
   */
  maxUploadBytes: 6 * 1024 * 1024,

  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
} as const;

/**
 * How a photograph is reduced in the browser before it is uploaded.
 *
 * Re-encoding is what removes EXIF metadata. Family photographs routinely carry
 * GPS coordinates, and a memorial site is exactly the sort of place where the
 * address of a house should not be published as a side effect of sharing a
 * picture taken in its garden. Drawing to a canvas and encoding the result
 * keeps the pixels and nothing else.
 *
 * The long edge is what is capped, so portrait and landscape are treated alike.
 */
export const photoProcessing = {
  /** Long edge of the stored photograph. Comfortably more than any screen shows. */
  maxImageEdge: 2560,

  /** Long edge of the thumbnail used in the gallery grid. */
  maxThumbnailEdge: 480,

  /**
   * JPEG quality for each. Tried in order for the full-size image: if the first
   * attempt will not fit maxUploadBytes, the next is tried before giving up.
   */
  imageQualities: [0.82, 0.7, 0.6],
  thumbnailQuality: 0.7,
} as const;

export const memoryFormLimits = {
  maxNameLength: 80,
  maxMessageLength: 2000,
} as const;
