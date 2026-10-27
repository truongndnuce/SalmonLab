import { API_URL } from '@/lib/env';
import { renderMarkdown } from '@/lib/markdown';

const MAX_BYTES = 500_000;

/**
 * Renders Markdown with the exact pipeline used on public pages, so the admin preview is what readers will see.
 * Requires a valid admin access token (checked against the API) so it can't be used as an open render service.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await fetch(`${API_URL}/auth/me`, { headers: { authorization: auth }, cache: 'no-store' }).catch(() => null);
  if (!me?.ok) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { md?: unknown } | null;
  if (typeof body?.md !== 'string') return Response.json({ error: 'md required' }, { status: 400 });
  if (body.md.length > MAX_BYTES) return Response.json({ error: 'Content too large' }, { status: 413 });

  return Response.json(await renderMarkdown(body.md));
}
