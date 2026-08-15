const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function parse(isoDate: string): Date | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats an ISO 8601 date for display, e.g. "2 July 2026". Empty when unparseable. */
export function formatDate(isoDate: string): string {
  const date = parse(isoDate);
  return date ? dateFormatter.format(date) : '';
}

/** Formats an ISO 8601 timestamp for display, e.g. "2 July 2026, 18:20". */
export function formatDateTime(isoDate: string): string {
  const date = parse(isoDate);
  return date ? dateTimeFormatter.format(date) : '';
}

/** Formats a byte count for the upload page, e.g. "3.4 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
