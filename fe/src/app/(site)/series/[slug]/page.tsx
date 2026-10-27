import Link from 'next/link';
import { api, apiOrNotFound } from '@/lib/api-client';
import { buildMetadata } from '@/lib/seo';
import type { SeriesDetail, SiteInfo } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };
const tags = (slug: string) => ['series', `series:${slug}`];

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [{ data: s }, { data: site }] = await Promise.all([
    apiOrNotFound<SeriesDetail>(`/series/${slug}`, { tags: tags(slug) }),
    api<SiteInfo>('/site', { tags: ['site'] }),
  ]);
  return buildMetadata({ title: s.title, description: s.description, path: `/series/${slug}`, image: s.coverUrl, siteName: site.name });
}

export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const { data: series } = await apiOrNotFound<SeriesDetail>(`/series/${slug}`, { tags: tags(slug) });
  return (
    <>
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Loạt bài</p>
        <h1 className="mt-1 text-[32px] font-bold">{series.title}</h1>
        {series.description && <p className="mt-2 italic text-muted">{series.description}</p>}
      </header>
      {series.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- cover is served from the CDN
        <img src={series.coverUrl} alt="" className="mb-8 w-full rounded-card" />
      )}
      <ol className="space-y-4">
        {series.items.map((item, i) => (
          <li key={item.slug} className="flex gap-4">
            <span className="tabular-nums text-muted">{String(item.seriesOrder ?? i + 1).padStart(2, '0')}</span>
            <div>
              <Link href={`${item.kind === 'POST' ? '/posts' : '/infographic'}/${item.slug}`} className="font-semibold text-accent hover:text-accent-hover">
                {item.title}
              </Link>
              {item.excerpt && <p className="text-sm text-muted">{item.excerpt}</p>}
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
