import { appConfig } from '../config/appConfig';

/**
 * An error that is safe to show to a visitor.
 *
 * Services throw these so that pages never have to inspect a raw fetch
 * rejection, and never render an unexpected exception message.
 */
export class ApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string): string {
  const normalisedPath = path.startsWith('/') ? path : `/${path}`;
  return `${appConfig.apiBaseUrl}${normalisedPath}`;
}

function messageForStatus(status: number): string {
  if (status === 404) return 'That information could not be found.';
  if (status === 413) return 'The files you selected are too large to upload.';
  if (status === 429) return 'Too many requests have been made. Please try again shortly.';
  if (status >= 500) return 'The server is temporarily unavailable. Please try again shortly.';
  return 'The request could not be completed. Please check your details and try again.';
}

/**
 * Performs a JSON request against the configured API.
 *
 * The response body is trusted to match `T`; the Worker owns that contract.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(appConfig.requestTimeoutMs),
    });
  } catch (cause) {
    throw new ApiError(
      'Could not reach the server. Please check your connection and try again.',
      undefined,
      { cause },
    );
  }

  if (!response.ok) {
    throw new ApiError(messageForStatus(response.status), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError('The server sent a response that could not be understood.', response.status, {
      cause,
    });
  }
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'POST', body, signal }),
};
