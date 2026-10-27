'use client';

import { useCallback, useEffect, useState } from 'react';
import { get, errorMessage, type Envelope } from './api';

/** Fetches `path` (skips while null) and exposes reload; keeps previous data while refetching. */
export function useAdminData<T>(path: string | null) {
  const [result, setResult] = useState<Envelope<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let alive = true;
    setLoading(true);
    get<T>(path)
      .then((r) => {
        if (!alive) return;
        setResult(r);
        setError(null);
      })
      .catch((e) => alive && setError(errorMessage(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data: result?.data ?? null, meta: result?.meta ?? null, error, loading, reload };
}
