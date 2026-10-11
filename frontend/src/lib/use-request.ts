'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api-error';

/**
 * Minimal async loader: { data, error, loading, reload, mutate }.
 * `mutate` updates the cached data locally (for optimistic updates) without refetching.
 */
export function useRequest<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(ApiError.from(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback((update: (current: T | null) => T | null) => setData((d) => update(d)), []);

  return { data, error, loading, reload, mutate };
}
