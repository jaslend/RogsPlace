import { ApiError } from '../api/apiClient';

const GENERIC_MESSAGE = 'Sorry, something went wrong. Please try again in a moment.';

/**
 * Turns anything that was thrown into a sentence that is safe to show a
 * visitor. Unexpected errors are logged for developers but never rendered.
 */
export function toUserMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (import.meta.env.DEV) {
    console.error('Unexpected error:', error);
  }

  return fallback;
}
