const TZ = 'Asia/Ho_Chi_Minh';

function parts(iso: string) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
}

/** 2026-10-14 */
export function isoDate(iso: string) {
  const p = parts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 14/10/2026 */
export function viDate(iso: string) {
  const p = parts(iso);
  return `${p.day}/${p.month}/${p.year}`;
}

/** 14/10/2026 · 23:29 */
export function viDateTime(iso: string) {
  const p = parts(iso);
  return `${p.day}/${p.month}/${p.year} · ${p.hour}:${p.minute}`;
}

export const yearOf = (iso: string) => Number(parts(iso).year);

/** "338 từ · 2 phút đọc" */
export const readingLabel = (wordCount: number, readingMins: number) =>
  `${wordCount.toLocaleString('vi-VN')} từ · ${readingMins} phút đọc`;
