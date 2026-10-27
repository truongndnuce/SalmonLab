import Link from 'next/link';
import { api } from '@/lib/api-client';
import { isoDate } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import type { PostSummary, SiteInfo } from '@/lib/types';

export async function generateMetadata() {
  const { data: site } = await api<SiteInfo>('/site', { tags: ['site'] });
  return buildMetadata({ title: 'Infographic', path: '/infographic', description: 'Giải thích bằng hình và mô phỏng tương tác.', siteName: site.name });
}

export default async function InfographicsPage() {
  const { data: items } = await api<PostSummary[]>('/infographics?pageSize=100', { tags: ['infographics'] });
  return (
    <>
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Xem để hiểu</p>
        <h1 className="mt-1 text-[32px] font-bold">Infographic</h1>
      </header>
      {items.length === 0 && <p className="text-center text-muted">Chưa có infographic nào.</p>}
      <div className="space-y-6">
        {items.map((p) => (
          <article key={p.id} className="overflow-hidden rounded-card border border-border">
            {p.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- cover is served from the CDN
              <img src={p.coverUrl} alt={p.coverAlt ?? ''} className="w-full bg-surface" />
            )}
            <div className="p-5">
              <time dateTime={p.publishedAt} className="text-sm text-muted">{isoDate(p.publishedAt)}</time>
              <h2 className="mt-1 text-lg font-bold">{p.title}</h2>
              {p.excerpt && <p className="mt-1 text-muted">{p.excerpt}</p>}
              <Link href={`/infographic/${p.slug}`} className="mt-3 inline-block text-accent hover:text-accent-hover">
                Xem infographic →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
