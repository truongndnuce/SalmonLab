import { ApiError, api } from '@/lib/api-client';
import { renderOg } from '@/lib/og';
import type { PostDetail, SiteInfo } from '@/lib/types';

const KINDS = {
  posts: { api: '/posts', tag: 'post', label: 'Bài viết' },
  infographic: { api: '/infographics', tag: 'infographic', label: 'Infographic' },
} as const;

/** Share card for a post or infographic, referenced from the page's og:image / twitter:image. */
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; slug: string }> }) {
  const { kind, slug } = await params;
  if (kind !== 'posts' && kind !== 'infographic') return new Response('Not found', { status: 404 });
  const k = KINDS[kind];
  try {
    const [{ data: p }, { data: site }] = await Promise.all([
      api<PostDetail>(`${k.api}/${encodeURIComponent(slug)}`, { tags: [`${k.tag}:${slug}`] }),
      api<SiteInfo>('/site', { tags: ['site'] }),
    ]);
    const img = await renderOg({ title: p.title, kicker: p.category?.name ?? k.label, description: p.excerpt, siteName: site.name });
    img.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    return img;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return new Response('Not found', { status: 404 });
    throw e;
  }
}
