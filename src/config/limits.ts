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
  maxBytesPerFile: 20 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  acceptedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
} as const;

export const memoryFormLimits = {
  maxNameLength: 80,
  maxMessageLength: 2000,
} as const;
