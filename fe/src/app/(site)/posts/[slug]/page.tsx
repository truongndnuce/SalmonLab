import { Article } from '@/components/content/Article';
import { api, apiOrRedirect } from '@/lib/api-client';
import { SITE_URL } from '@/lib/env';
import { buildMetadata } from '@/lib/seo';
import type { PostDetail, SiteInfo } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  // The API may be unreachable at build time (e.g. CI); pages are then generated on first request.
  try {
    const { data } = await api<{ slug: string }[]>('/posts?pageSize=1000&fields=slug', { tags: ['posts'] });
    return data.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [{ data: p }, { data: site }] = await Promise.all([
    apiOrRedirect<PostDetail>(`/posts/${slug}`, { section: 'posts', basePath: '/posts', slug, tag: `post:${slug}` }),
    api<SiteInfo>('/site', { tags: ['site'] }),
  ]);
  return buildMetadata({
    title: p.title,
    description: p.excerpt,
    path: `/posts/${slug}`,
    image: `${SITE_URL}/og/posts/${slug}`,
    type: 'article',
    publishedTime: p.publishedAt,
    modifiedTime: p.updatedAt,
    siteName: site.name,
  });
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const { data: post } = await apiOrRedirect<PostDetail>(`/posts/${slug}`, { section: 'posts', basePath: '/posts', slug, tag: `post:${slug}` });
  return <Article post={post} basePath="/posts" backLabel="Tất cả bài viết" />;
}
