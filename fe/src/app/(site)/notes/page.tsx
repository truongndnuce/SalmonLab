import Link from 'next/link';
import { NoteCard } from '@/components/content/NoteCard';
import { NoteFilter } from '@/components/content/NoteFilter';
import { api } from '@/lib/api-client';
import { buildMetadata } from '@/lib/seo';
import type { Note, SiteInfo } from '@/lib/types';

const PAGE_SIZE = 10;
type Props = { searchParams: Promise<{ year?: string; month?: string; page?: string }> };

export async function generateMetadata() {
  const { data: site } = await api<SiteInfo>('/site', { tags: ['site'] });
  return buildMetadata({ title: 'Ghi chú', path: '/notes', description: 'Dòng ghi chép ngắn.', siteName: site.name });
}

const int = (v?: string) => (v && /^\d+$/.test(v) ? Number(v) : undefined);

export default async function NotesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const year = int(sp.year);
  const month = year ? int(sp.month) : undefined;
  const page = int(sp.page) ?? 1;

  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (year) qs.set('year', String(year));
  if (month) qs.set('month', String(month));

  const [{ data: notes, meta }, { data: archive }] = await Promise.all([
    api<Note[]>(`/notes?${qs}`, { tags: ['notes'] }),
    api<{ year: number; months: number[] }[]>('/notes/archive', { tags: ['notes'] }),
  ]);

  const link = (p: number) => {
    const q = new URLSearchParams();
    if (year) q.set('year', String(year));
    if (month) q.set('month', String(month));
    if (p > 1) q.set('page', String(p));
    return q.size ? `/notes?${q}` : '/notes';
  };
  const hasMore = meta ? meta.page * meta.pageSize < meta.total : false;

  return (
    <>
      <header className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Dòng ghi chép</p>
        <h1 className="mt-1 text-[32px] font-bold">Ghi chú</h1>
        <div className="mt-5 flex justify-center">
          <NoteFilter archive={archive} year={year} month={month} />
        </div>
      </header>
      {notes.length === 0 && <p className="text-center text-muted">Không có ghi chú nào.</p>}
      <div className="space-y-5">
        {notes.map((n) => (
          <NoteCard key={n.id} note={n} />
        ))}
      </div>
      <nav aria-label="Phân trang" className="mt-8 flex justify-between text-sm">
        {page > 1 ? <Link href={link(page - 1)} className="text-accent">← Mới hơn</Link> : <span />}
        {hasMore ? <Link href={link(page + 1)} className="text-accent">Cũ hơn →</Link> : <span />}
      </nav>
    </>
  );
}
