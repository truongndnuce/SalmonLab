import { readingStats } from './reading-stats';

describe('readingStats', () => {
  it('returns minimum 1 minute for empty/short text', () => {
    expect(readingStats('')).toEqual({ wordCount: 0, readingMins: 1 });
    expect(readingStats(' xin chào ')).toEqual({
      wordCount: 2,
      readingMins: 1,
    });
  });
  it('rounds up at 200 wpm', () => {
    expect(readingStats('a '.repeat(201)).readingMins).toBe(2);
    expect(readingStats('a '.repeat(200)).readingMins).toBe(1);
  });
});
