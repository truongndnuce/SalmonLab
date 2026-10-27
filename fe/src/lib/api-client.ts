import { notFound, permanentRedirect } from 'next/navigation';
import { API_URL } from './env';
import type { ApiOk } from './types';

interface Options {
  tags?: string[];
  /** Seconds. Fallback TTL in case a revalidation webhook is missed. */
  revalidate?: number;
  /** Bypass the data cache (per-request results such as search). */
  noStore?: boolean;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`API ${status} ${path}`);
  }
}

export async function api<T>(path: string, { tags, revalidate = 3600, noStore }: Options = {}): Promise<ApiOk<T>> {
  const res = await fetch(`${API_URL}${path}`, noStore ? { cache: 'no-store' } : { next: { tags, revalidate } });
  if (!res.ok) throw new ApiError(res.status, path);
  return (await res.json()) as ApiOk<T>;
}

/** Like api(), but turns a 404 from the API into Next's notFound(). */
export async function apiOrNotFound<T>(path: string, options?: Options): Promise<ApiOk<T>> {
  try {
    return await api<T>(path, options);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

/**
 * Post/infographic lookup that honours renamed slugs: when the slug is unknown but was redirected, answer with a
 * permanent redirect to the new URL instead of a 404. The redirect lookup is tagged with the old slug's tag, which
 * the API revalidates when the slug changes.
 */
export async function apiOrRedirect<T>(
  path: string,
  { section, basePath, slug, tag }: { section: 'posts' | 'infographic'; basePath: string; slug: string; tag: string },
): Promise<ApiOk<T>> {
  try {
    return await api<T>(path, { tags: [tag] });
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 404) throw err;
    let target: string | null = null;
    try {
      target = (await api<{ slug: string }>(`/redirects/${section}/${encodeURIComponent(slug)}`, { tags: [tag] })).data.slug;
    } catch {
      /* no redirect: a genuine 404 */
    }
    if (target) permanentRedirect(`${basePath}/${target}`);
    notFound();
  }
}
