import { timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';

function validSecret(given: string | null): boolean {
  const expected = process.env.REVALIDATE_SECRET;
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Called by the NestJS API after content changes; see be/src/modules/revalidate. */
export async function POST(req: Request) {
  if (!validSecret(req.headers.get('x-revalidate-secret'))) {
    return new Response('Unauthorized', { status: 401 });
  }
  const body = (await req.json().catch(() => null)) as { tags?: unknown } | null;
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t): t is string => typeof t === 'string' && t.length > 0) : [];
  if (tags.length === 0) return Response.json({ error: 'tags required' }, { status: 400 });
  tags.forEach((t) => revalidateTag(t));
  return Response.json({ revalidated: tags });
}
