'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from './api-error';

/**
 * Minimal async loader: { data, error, loading, reloading, reload, mutate }.
 * `mutate` updates the cached data locally (for optimistic updates) without refetching.
 * `keepPrevious` keeps old data visible while refetching (no full skeleton flash).
 */
export function useRequest<T>(fn: () => Promise<T>, deps: unknown[] = [], opts?: { keepPrevious?: boolean }) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true); // true only until first result
  const [reloading, setReloading] = useState(false); // background refetch with data shown
  const keepPrevious = opts?.keepPrevious ?? true;
  const seq = useRef(0);
  const hasData = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    // First load (or keepPrevious off): full skeleton. Otherwise keep old rows up.
    if (!hasData.current || !keepPrevious) setLoading(true);
    else setReloading(true);
    setError(null);
    try {
      const result = await run();
      if (id === seq.current) {
        setData(result);
        hasData.current = true;
      }
    } catch (e) {
      if (id === seq.current) setError(ApiError.from(e));
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setReloading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const mutate = useCallback((update: (current: T | null) => T | null) => setData((d) => update(d)), []);

  return { data, error, loading, reloading, reload, mutate };
}
