import type { Metadata } from 'next';
import Link from 'next/link';
import { ApiError, api } from '@/lib/api-client';
import { viDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { SearchResult } from '@/lib/types';

type Props = { searchParams: Promise<{ q?: string; type?: string; page?: string }> };

const TYPES = [
  ['all', 'Tất cả'],
  ['post', 'Bài viết'],
  ['infographic', 'Infographic'],
  ['note', 'Ghi chú'],
] as const;
const LABEL = { post: 'Bài viết', infographic: 'Infographic', note: 'Ghi chú' } as const;
const HREF = { post: '/posts', infographic: '/infographic', note: '/notes' } as const;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  // Result pages are never useful as search-engine landing pages.
  return { title: q ? `${t('search.submit')} “${q}”` : t('search.title'), robots: { index: false, follow: true } };
}

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const type = TYPES.some(([t]) => t === sp.type) ? sp.type! : 'all';
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  let results: SearchResult[] = [];
  let total = 0;
  let pageSize = 10;
  let problem: string | null = null;
  if (q) {
    if (q.length < 2) {
      problem = t('search.tooShort');
    } else {
      try {
        const qs = new URLSearchParams({ q, type, page: String(page) });
        const res = await api<SearchResult[]>(`/search?${qs}`, { noStore: true });
        results = res.data;
        total = res.meta?.total ?? results.length;
        pageSize = res.meta?.pageSize ?? pageSize;
      } catch (e) {
        problem = e instanceof ApiError && e.status === 429 ? t('search.rateLimited') : t('search.failed');
      }
    }
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number, t = type) => `/search?${new URLSearchParams({ q, ...(t !== 'all' && { type: t }), ...(p > 1 && { page: String(p) }) })}`;

  return (
    <>
      <h1 className="mb-6 text-center text-[32px] font-bold">{t('search.title')}</h1>
      <form action="/search" role="search" className="mb-4 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label={t('search.keyword')}
          placeholder={t('search.placeholder')}
          autoFocus={!q}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
        />
        {type !== 'all' && <input type="hidden" name="type" value={type} />}
        <button type="submit" className="rounded-md border border-accent bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent-hover">
          {t('search.submit')}
        </button>
      </form>

      {q && (
        <nav aria-label={t('search.types')} className="mb-6 flex flex-wrap justify-center gap-2 text-sm">
          {TYPES.map(([t, label]) => (
            <Link
              key={t}
              href={href(1, t)}
              aria-current={type === t ? 'true' : undefined}
              className={`rounded-full border px-3 py-0.5 ${type === t ? 'border-accent bg-surface-note font-semibold text-accent' : 'border-border text-muted hover:text-accent'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      {problem && <p role="alert" className="text-center text-muted">{problem}</p>}
      {q && !problem && (
        <p className="mb-4 text-sm text-muted" aria-live="polite">
          {total > 0 ? t('search.count', { n: total, q }) : t('search.none', { q })}
        </p>
      )}
      <ol className="space-y-6">
        {results.map((r) => (
          <li key={`${r.type}:${r.slug}`}>
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              {LABEL[r.type]} · {viDate(r.publishedAt)}
            </p>
            <Link href={`${HREF[r.type]}/${r.slug}`} className="text-lg font-bold text-accent hover:text-accent-hover">
              {r.title}
            </Link>
            {r.snippet && <p className="mt-1 text-[15px] text-fg/80">{r.snippet}</p>}
          </li>
        ))}
      </ol>
      {pages > 1 && (
        <nav aria-label={t('pagination.label')} className="mt-8 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="text-accent hover:text-accent-hover">{t('pagination.prev')}</Link> : <span />}
          <span className="text-muted">{t('pagination.page', { page, pages })}</span>
          {page < pages ? <Link href={href(page + 1)} className="text-accent hover:text-accent-hover">{t('pagination.next')}</Link> : <span />}
        </nav>
      )}
    </>
  );
}
