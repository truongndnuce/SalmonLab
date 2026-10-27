import { PostsExplorer } from '@/components/content/PostsExplorer';
import { api } from '@/lib/api-client';
import { buildMetadata } from '@/lib/seo';
import type { PostSummary, SiteInfo, Taxon } from '@/lib/types';

export async function generateMetadata() {
  const { data: site } = await api<SiteInfo>('/site', { tags: ['site'] });
  return buildMetadata({ title: 'Bài viết', path: '/posts', description: site.tagline, siteName: site.name });
}

export default async function PostsPage() {
  const [{ data: posts }, { data: categories }] = await Promise.all([
    api<PostSummary[]>('/posts?pageSize=1000', { tags: ['posts'] }),
    api<Taxon[]>('/taxonomy/categories', { tags: ['posts'] }),
  ]);
  return (
    <>
      <h1 className="mb-8 text-center text-[32px] font-bold">Bài viết</h1>
      <PostsExplorer posts={posts} categories={categories} />
    </>
  );
}
