import { appConfig } from '../config/appConfig';
import { formatFileSize } from './formatDate';

const { maxFiles, maxBytesPerFile, acceptedMimeTypes, acceptedExtensions } = appConfig.upload;

export interface RejectedFile {
  fileName: string;
  reason: string;
}

export interface FileValidationResult {
  accepted: File[];
  rejected: RejectedFile[];
}

/** The value for an <input type="file"> accept attribute. */
export const acceptAttribute = [...acceptedMimeTypes, ...acceptedExtensions].join(',');

export const acceptedFormatsLabel = 'JPEG, PNG or WebP';

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return acceptedExtensions.some((extension) => lower.endsWith(extension));
}

function isAcceptedType(file: File): boolean {
  // Some browsers report an empty type; fall back to the extension in that case.
  if (file.type === '') return hasAcceptedExtension(file.name);
  return (acceptedMimeTypes as readonly string[]).includes(file.type);
}

function isSameFile(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

/**
 * Checks files chosen in the browser before anything is sent to the backend.
 *
 * This is a convenience check only. The Worker must repeat every one of these
 * rules -- and sniff the real file format -- because nothing arriving from a
 * browser can be trusted. SVG is rejected for photographs because it can carry
 * script.
 */
export function validateSelectedFiles(
  newFiles: readonly File[],
  alreadySelected: readonly File[] = [],
): FileValidationResult {
  const accepted: File[] = [];
  const rejected: RejectedFile[] = [];
  let slotsRemaining = maxFiles - alreadySelected.length;

  for (const file of newFiles) {
    if (alreadySelected.some((existing) => isSameFile(existing, file))) {
      rejected.push({ fileName: file.name, reason: 'This photograph has already been selected.' });
      continue;
    }

    if (!isAcceptedType(file)) {
      rejected.push({
        fileName: file.name,
        reason: `Only ${acceptedFormatsLabel} photographs can be uploaded.`,
      });
      continue;
    }

    if (file.size === 0) {
      rejected.push({ fileName: file.name, reason: 'This file appears to be empty.' });
      continue;
    }

    if (file.size > maxBytesPerFile) {
      rejected.push({
        fileName: file.name,
        reason: `This photograph is larger than the ${formatFileSize(maxBytesPerFile)} limit.`,
      });
      continue;
    }

    if (slotsRemaining <= 0) {
      rejected.push({
        fileName: file.name,
        reason: `No more than ${maxFiles} photographs can be uploaded at once.`,
      });
      continue;
    }

    accepted.push(file);
    slotsRemaining -= 1;
  }

  return { accepted, rejected };
}
