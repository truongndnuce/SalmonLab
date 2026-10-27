import Link from 'next/link';
import { SITE_URL } from '@/lib/env';
import { renderMarkdown } from '@/lib/markdown';
import type { PostDetail } from '@/lib/types';
import { ArticleMeta } from './ArticleMeta';
import { JsonLd } from './JsonLd';
import { Toc } from './Toc';
import { WidgetRuntime } from './WidgetRuntime';

/** Shared by /posts/[slug] and /infographic/[slug]. */
export async function Article({ post, basePath, backLabel }: { post: PostDetail; basePath: '/posts' | '/infographic'; backLabel: string }) {
  const { html, toc } = await renderMarkdown(post.bodyMd);
  const url = `${SITE_URL}${basePath}/${post.slug}`;

  return (
    <article>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt ?? undefined,
          image: post.coverUrl ?? undefined,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          inLanguage: 'vi',
          mainEntityOfPage: url,
        }}
      />
      <Link href={basePath} className="text-sm text-muted hover:text-accent">
        ← {backLabel}
      </Link>
      <header className="mt-6">
        {post.category && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{post.category.name}</p>}
        <h1 className="mt-1 text-[32px] font-bold leading-tight">{post.title}</h1>
        <div className="mt-2">
          <ArticleMeta publishedAt={post.publishedAt} wordCount={post.wordCount} readingMins={post.readingMins} />
        </div>
      </header>
      {post.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- media URLs come from the CDN, sizes are variants we generate
        <img src={post.coverUrl} alt={post.coverAlt ?? ''} className="mt-6 w-full rounded-card" />
      )}
      <Toc items={toc} />
      <div className="prose prose-salmon mt-8 max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      <WidgetRuntime />

      {post.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2 text-sm text-muted">
          {post.tags.map((t) => (
            <li key={t.id} className="rounded-full border border-border bg-surface-note px-3 py-0.5">
              {t.name}
            </li>
          ))}
        </ul>
      )}

      {post.series && post.seriesPosts.length > 1 && (
        <aside className="mt-10 rounded-card border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Loạt bài</p>
          <Link href={`/series/${post.series.slug}`} className="font-bold hover:text-accent">
            {post.series.title}
          </Link>
          <ol className="mt-3 space-y-1 text-[15px]">
            {post.seriesPosts.map((s, i) => (
              <li key={s.slug} className="flex gap-3">
                <span className="tabular-nums text-muted">{String(s.seriesOrder ?? i + 1).padStart(2, '0')}</span>
                {s.slug === post.slug ? <span className="font-semibold">{s.title}</span> : <Link href={`${basePath}/${s.slug}`} className="text-accent hover:text-accent-hover">{s.title}</Link>}
              </li>
            ))}
          </ol>
        </aside>
      )}

      <nav aria-label="Bài trước và sau" className="mt-10 flex justify-between gap-6 border-t border-border pt-6 text-sm">
        {post.prev ? (
          <Link href={`${basePath}/${post.prev.slug}`} className="text-accent hover:text-accent-hover">
            ← {post.prev.title}
          </Link>
        ) : (
          <span />
        )}
        {post.next ? (
          <Link href={`${basePath}/${post.next.slug}`} className="text-right text-accent hover:text-accent-hover">
            {post.next.title} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
