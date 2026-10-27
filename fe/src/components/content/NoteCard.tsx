import Link from 'next/link';
import { viDateTime } from '@/lib/format';
import type { Note } from '@/lib/types';
import { Prose } from './Prose';

/** Compact preview used on the home page: left rule, date, truncated plain text. */
export function NoteSnippet({ note }: { note: Note }) {
  const text = note.bodyMd.replace(/[`*_>#\[\]]/g, '').replace(/\s+/g, ' ').trim();
  const clipped = text.length > 220 ? `${text.slice(0, 220).trimEnd()}…` : text;
  return (
    <li className="border-l-4 border-border bg-surface-note px-4 py-3">
      <Link href={`/notes/${note.slug}`} className="block hover:text-accent">
        <time dateTime={note.publishedAt} className="text-sm text-muted">
          {viDateTime(note.publishedAt)}
        </time>
        <p className="mt-1">{clipped}</p>
      </Link>
    </li>
  );
}

/** Full note card used on /notes and the note page. */
export function NoteCard({ note }: { note: Note }) {
  return (
    <article className="rounded-card border border-border bg-surface p-6">
      <time dateTime={note.publishedAt} className="text-sm text-muted">
        {viDateTime(note.publishedAt)}
      </time>
      {note.title && <h3 className="mt-1 text-lg font-bold">{note.title}</h3>}
      <div className="mt-3">
        <Prose md={note.bodyMd} />
      </div>
      <Link href={`/notes/${note.slug}`} className="mt-4 inline-block text-sm text-muted hover:text-accent">
        Liên kết ghi chú →
      </Link>
    </article>
  );
}
