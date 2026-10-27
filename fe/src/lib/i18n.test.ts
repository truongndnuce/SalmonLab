import { describe, expect, it } from 'vitest';
import { t } from './i18n';

describe('t', () => {
  it('returns the string and fills placeholders', () => {
    expect(t('nav.search')).toBe('Tìm kiếm');
    expect(t('search.count', { n: 3, q: 'mây' })).toBe('3 kết quả cho “mây”');
  });
  it('leaves unknown placeholders visible instead of dropping them', () => {
    expect(t('search.none')).toContain('{q}');
  });
});
