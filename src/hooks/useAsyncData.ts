import { useCallback, useEffect, useRef, useState } from 'react';
import { toUserMessage } from '../utils/errors';

export type AsyncStatus = 'loading' | 'success' | 'error';

export interface AsyncData<T> {
  status: AsyncStatus;
  data: T | null;
  error: string | null;
  reload: () => void;
}

/**
 * Loads data from a service and exposes the loading, empty and error states
 * that every page needs, without any page having to repeat the plumbing.
 *
 * The loader is captured in a ref, so an inline arrow function is fine: the
 * request runs once on mount and again whenever `reload` is called.
 */
export function useAsyncData<T>(loader: () => Promise<T>, errorMessage?: string): AsyncData<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => {
    setAttempt((previous) => previous + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    loaderRef
      .current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setStatus('success');
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(toUserMessage(cause, errorMessage));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, errorMessage]);

  return { status, data, error, reload };
}
