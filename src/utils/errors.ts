import { ApiError } from '../api/apiClient';
import { PhotoPreparationError } from './preparePhoto';

const GENERIC_MESSAGE = 'Sorry, something went wrong. Please try again in a moment.';

/**
 * Turns anything that was thrown into a sentence that is safe to show a
 * visitor. Unexpected errors are logged for developers but never rendered.
 *
 * The listed types are the ones whose messages are written for a reader rather
 * than for a log: an API refusal explaining why, and a photograph that could not
 * be prepared for upload. Everything else becomes the fallback, because an
 * arbitrary error message may carry internal detail.
 */
export function toUserMessage(error: unknown, fallback: string = GENERIC_MESSAGE): string {
  if (error instanceof ApiError || error instanceof PhotoPreparationError) {
    return error.message;
  }

  if (import.meta.env.DEV) {
    console.error('Unexpected error:', error);
  }

  return fallback;
}
