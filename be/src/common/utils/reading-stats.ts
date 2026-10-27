const WORDS_PER_MINUTE = 200;

export function readingStats(bodyMd: string): {
  wordCount: number;
  readingMins: number;
} {
  const trimmed = bodyMd.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  return {
    wordCount,
    readingMins: Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)),
  };
}
