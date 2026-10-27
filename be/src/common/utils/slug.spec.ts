import { noteSlug, slugifyVi, uniqueSlug } from './slug';

describe('slugifyVi', () => {
  it('strips diacritics and maps đ', () => {
    expect(slugifyVi('Xây dựng hệ thống quản trị cá nhân < 1$/tháng')).toBe(
      'xay-dung-he-thong-quan-tri-ca-nhan-1-thang',
    );
    expect(slugifyVi('Đường đi')).toBe('duong-di');
  });
  it('trims separators', () => {
    expect(slugifyVi('  --Hello, World!-- ')).toBe('hello-world');
  });
});

describe('uniqueSlug', () => {
  it('adds numeric suffix on collision', async () => {
    const taken = new Set(['a', 'a-2']);
    expect(await uniqueSlug('a', async (s) => taken.has(s))).toBe('a-3');
    expect(await uniqueSlug('b', async (s) => taken.has(s))).toBe('b');
  });
});

describe('noteSlug', () => {
  it('formats timestamp in UTC+7 with hex suffix', () => {
    expect(noteSlug(new Date('2026-10-14T09:29:46Z'), 'eb34')).toBe(
      '20261014162946-eb34',
    );
  });
  it('generates a 4-char hex suffix by default', () => {
    expect(noteSlug()).toMatch(/^\d{14}-[0-9a-f]{4}$/);
  });
});
