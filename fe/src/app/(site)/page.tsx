import { FeaturedStrip } from '@/components/content/FeaturedStrip';
import { NoteSnippet } from '@/components/content/NoteCard';
import { PostRow } from '@/components/content/PostRow';
import { SectionHeading } from '@/components/content/SectionHeading';
import { api } from '@/lib/api-client';
import { buildMetadata } from '@/lib/seo';
import type { HomeData, SiteInfo } from '@/lib/types';

export async function generateMetadata() {
  const { data: site } = await api<SiteInfo>('/site', { tags: ['site'] });
  return buildMetadata({ path: '/', description: site.tagline, siteName: site.name, image: site.coverUrl });
}

export default async function HomePage() {
  const [{ data: site }, { data: home }] = await Promise.all([
    api<SiteInfo>('/site', { tags: ['site'] }),
    api<HomeData>('/home', { tags: ['home'] }),
  ]);

  const featured = [
    ...home.featured.series.map((s) => ({ href: `/series/${s.slug}`, title: s.title, kicker: 'Loạt bài' })),
    ...home.featured.posts.map((p) => ({ href: `/posts/${p.slug}`, title: p.title, kicker: p.category?.name ?? 'Bài viết' })),
  ];

  return (
    <>
      <section className="text-center">
        {site.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- cover is served from the CDN
          <img src={site.coverUrl} alt="" className="mx-auto mb-6 w-full max-w-[480px] rounded-card" />
        )}
        <h1 className="text-[32px] font-bold">{site.name}</h1>
        <p className="mx-auto mt-2 max-w-[520px] italic text-muted">{site.tagline}</p>
      </section>

      {featured.length > 0 && (
        <section className="mt-12">
          <SectionHeading title="Nổi bật" />
          <FeaturedStrip items={featured} />
        </section>
      )}

      <section className="mt-12">
        <SectionHeading title="Các bài viết gần đây:" href="/posts" />
        <ul className="space-y-3">
          {home.recentPosts.map((p) => (
            <PostRow key={p.id} href={`/posts/${p.slug}`} title={p.title} publishedAt={p.publishedAt} />
          ))}
        </ul>
      </section>

      {home.recentNotes.length > 0 && (
        <section className="mt-12">
          <SectionHeading title="Ghi chú gần đây" href="/notes" />
          <ul className="space-y-3">
            {home.recentNotes.map((n) => (
              <NoteSnippet key={n.id} note={n} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
