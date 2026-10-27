import { Article } from '@/components/content/Article';
import { api, apiOrRedirect } from '@/lib/api-client';
import { SITE_URL } from '@/lib/env';
import { buildMetadata } from '@/lib/seo';
import type { PostDetail, SiteInfo } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const { data } = await api<{ slug: string }[]>('/infographics?pageSize=1000&fields=slug', { tags: ['infographics'] });
    return data.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [{ data: p }, { data: site }] = await Promise.all([
    apiOrRedirect<PostDetail>(`/infographics/${slug}`, { section: 'infographic', basePath: '/infographic', slug, tag: `infographic:${slug}` }),
    api<SiteInfo>('/site', { tags: ['site'] }),
  ]);
  return buildMetadata({ title: p.title, description: p.excerpt, path: `/infographic/${slug}`, image: `${SITE_URL}/og/infographic/${slug}`, type: 'article', publishedTime: p.publishedAt, modifiedTime: p.updatedAt, siteName: site.name });
}

// Same renderer as a post; `::widget` directives become sandboxed iframes via WidgetRuntime.
export default async function InfographicPage({ params }: Props) {
  const { slug } = await params;
  const { data: post } = await apiOrRedirect<PostDetail>(`/infographics/${slug}`, { section: 'infographic', basePath: '/infographic', slug, tag: `infographic:${slug}` });
  return <Article post={post} basePath="/infographic" backLabel="Tất cả infographic" />;
}
