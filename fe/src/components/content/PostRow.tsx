import Link from 'next/link';
import { isoDate } from '@/lib/format';

/** title ──────── date, as in the reference site's post lists. */
export function PostRow({ href, title, publishedAt }: { href: string; title: string; publishedAt: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <Link href={href} className="text-accent hover:text-accent-hover hover:underline">
        {title}
      </Link>
      <span aria-hidden className="mb-1 min-w-4 flex-1 self-end border-b border-border" />
      <time dateTime={publishedAt} className="shrink-0 text-sm tabular-nums text-muted">
        {isoDate(publishedAt)}
      </time>
    </li>
  );
}
