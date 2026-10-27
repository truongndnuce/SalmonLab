import { isoDate, readingLabel } from '@/lib/format';

export function ArticleMeta({ publishedAt, wordCount, readingMins }: { publishedAt: string; wordCount: number; readingMins: number }) {
  return (
    <p className="text-sm text-muted">
      <time dateTime={publishedAt}>{isoDate(publishedAt)}</time> · {readingLabel(wordCount, readingMins)}
    </p>
  );
}
