import { fold, makeSnippet, searchTerms } from './snippet';

describe('search snippet helpers', () => {
  it('folds Vietnamese accents 1:1 so offsets still line up', () => {
    expect(fold('Điện toán ĐÁM mây')).toBe('dien toan dam may');
    expect(fold('Điện toán').length).toBe('Điện toán'.length);
  });

  it('builds safe, folded, unique terms', () => {
    expect(searchTerms('Điện  toán, "đám" mây! điện')).toEqual([
      'dien',
      'toan',
      'dam',
      'may',
    ]);
    expect(searchTerms("a:* | b' & (c)")).toEqual(['a', 'b', 'c']);
    expect(searchTerms('!!!')).toEqual([]);
  });

  it('cuts the snippet around the first accent-insensitive match', () => {
    const body = `${'Mở đầu dài. '.repeat(20)}Phần nói về điện toán đám mây rất hay. ${'Kết. '.repeat(60)}`;
    const s = makeSnippet(body, ['dien', 'toan']);
    expect(s).toContain('điện toán đám mây');
    expect(s.startsWith('…')).toBe(true);
    expect(s.endsWith('…')).toBe(true);
  });

  it('strips markdown and falls back to the start when nothing matches', () => {
    expect(
      makeSnippet('## Tiêu đề\n\n![a](x.png) **đậm** [link](http://x)', [
        'zzz',
      ]),
    ).toBe('Tiêu đề đậm link');
    expect(makeSnippet('', ['a'])).toBe('');
  });
});
