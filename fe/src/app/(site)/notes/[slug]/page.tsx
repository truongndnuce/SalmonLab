import Link from 'next/link';
import { NoteCard } from '@/components/content/NoteCard';
import { api, apiOrNotFound } from '@/lib/api-client';
import { viDateTime } from '@/lib/format';
import { buildMetadata } from '@/lib/seo';
import type { Note, SiteInfo } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  try {
    const { data } = await api<Note[]>('/notes?pageSize=100', { tags: ['notes'] });
    return data.map((n) => ({ slug: n.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [{ data: n }, { data: site }] = await Promise.all([
    apiOrNotFound<Note>(`/notes/${slug}`, { tags: [`note:${slug}`] }),
    api<SiteInfo>('/site', { tags: ['site'] }),
  ]);
  const text = n.bodyMd.replace(/[`*_>#\[\]]/g, '').replace(/\s+/g, ' ').trim();
  return buildMetadata({
    title: n.title ?? `Ghi chú ${viDateTime(n.publishedAt)}`,
    description: text.length > 160 ? `${text.slice(0, 157)}…` : text,
    path: `/notes/${slug}`,
    type: 'article',
    publishedTime: n.publishedAt,
    modifiedTime: n.updatedAt,
    siteName: site.name,
  });
}

export default async function NotePage({ params }: Props) {
  const { slug } = await params;
  const { data: note } = await apiOrNotFound<Note>(`/notes/${slug}`, { tags: [`note:${slug}`] });
  return (
    <>
      <Link href="/notes" className="mb-6 inline-block text-sm text-muted hover:text-accent">
        ← Tất cả ghi chú
      </Link>
      <NoteCard note={note} />
    </>
  );
}
