import { describe, expect, it } from 'vitest';
import { isoDate, readingLabel, viDate, viDateTime, yearOf } from './format';

describe('format (Asia/Ho_Chi_Minh)', () => {
  it('uses Vietnam time, not UTC', () => {
    // 17:30Z on 30 Sep is already 1 Oct in Vietnam.
    expect(isoDate('2026-09-30T17:30:00Z')).toBe('2026-10-01');
    expect(yearOf('2025-12-31T18:00:00Z')).toBe(2026);
  });

  it('formats dates and times the way the reference site shows them', () => {
    expect(viDate('2026-10-14T09:29:46Z')).toBe('14/10/2026');
    expect(viDateTime('2026-10-14T16:29:46Z')).toBe('14/10/2026 · 23:29');
  });

  it('formats the reading label', () => {
    expect(readingLabel(338, 2)).toBe('338 từ · 2 phút đọc');
    expect(readingLabel(1234, 7)).toContain('phút đọc');
  });
});
