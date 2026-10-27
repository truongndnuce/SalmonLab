import type { AdminMedia, AdminUser, ApiMeta } from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class AdminApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface Envelope<T> {
  data: T;
  meta?: ApiMeta;
}

// The access token lives only in memory; the refresh token is an httpOnly cookie managed by the API.
let accessToken: string | null = null;
let refreshInFlight: Promise<AdminUser | null> | null = null;
let onSessionLost: (() => void) | null = null;

export const getAccessToken = () => accessToken;
export const setSessionLostHandler = (fn: (() => void) | null) => {
  onSessionLost = fn;
};

async function parse<T>(res: Response): Promise<Envelope<T>> {
  if (res.status === 204) return { data: undefined as T };
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new AdminApiError(res.status, body?.error?.code ?? 'ERROR', body?.error?.message ?? res.statusText);
  }
  return body as Envelope<T>;
}

/**
 * Exchanges the refresh cookie for a new access token. Refresh tokens rotate and a reused one revokes the whole
 * session, so concurrent callers (React StrictMode, parallel requests) must share a single in-flight request.
 */
export function refreshSession(): Promise<AdminUser | null> {
  refreshInFlight ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const { data } = (await res.json()) as Envelope<{ accessToken: string; user: AdminUser }>;
      accessToken = data.accessToken;
      return data.user;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { data } = await parse<{ accessToken: string; user: AdminUser }>(res);
  accessToken = data.accessToken;
  return data.user;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
  accessToken = null;
}

export async function adminFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<Envelope<T>> {
  const isForm = typeof FormData !== 'undefined' && init.body instanceof FormData;
  const send = () =>
    fetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      credentials: 'include',
      headers: {
        // FormData sets its own multipart boundary header.
        ...(init.body !== undefined && !isForm && { 'content-type': 'application/json' }),
        ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      },
      body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
    });

  let res = await send();
  if (res.status === 401) {
    if (await refreshSession()) {
      res = await send();
    } else {
      onSessionLost?.();
    }
  }
  return parse<T>(res);
}

export const get = <T>(path: string) => adminFetch<T>(path);
export const post = <T>(path: string, body?: unknown) => adminFetch<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T>(path: string, body: unknown) => adminFetch<T>(path, { method: 'PATCH', body });
export const put = <T>(path: string, body: unknown) => adminFetch<T>(path, { method: 'PUT', body });
export const del = (path: string) => adminFetch<void>(path, { method: 'DELETE' });

export function uploadFile<T>(path: string, file: File, fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append('file', file);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return adminFetch<T>(path, { method: 'POST', body: form });
}

export function uploadImage(file: File, alt?: string) {
  const form = new FormData();
  form.append('file', file);
  if (alt) form.append('alt', alt);
  return adminFetch<AdminMedia>('/admin/media', { method: 'POST', body: form });
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Đã có lỗi xảy ra');
