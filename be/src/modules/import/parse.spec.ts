import * as AdmZip from 'adm-zip';
import { parseMarkdown, readZip, rewriteImages } from './parse';

describe('parseMarkdown', () => {
  it('reads Hugo-style front matter', () => {
    const d = parseMarkdown(
      '---\ntitle: "Đo lường"\nslug: do-luong\ndescription: Tóm tắt\ntags: [a, b]\ncategories: [KHCN]\ndate: 2023-05-01\n---\n\nNội dung',
    );
    expect(d).toMatchObject({
      title: 'Đo lường',
      slug: 'do-luong',
      excerpt: 'Tóm tắt',
      tags: ['a', 'b'],
      category: 'KHCN',
      kind: 'POST',
      bodyMd: 'Nội dung',
    });
    expect(d.date?.toISOString().slice(0, 10)).toBe('2023-05-01');
  });

  it('falls back to the first H1, then the filename, and accepts comma-separated tags', () => {
    expect(parseMarkdown('# Tiêu đề\n\nThân bài').title).toBe('Tiêu đề');
    expect(parseMarkdown('# Tiêu đề\n\nThân bài').bodyMd).toBe('Thân bài');
    expect(parseMarkdown('chỉ có chữ', 'bai-viet-moi.md').title).toBe(
      'bai viet moi',
    );
    expect(parseMarkdown('---\ntags: x, y\n---\nb').tags).toEqual(['x', 'y']);
  });

  it('reads Hugo TOML front matter', () => {
    const d = parseMarkdown(
      '+++\ntitle = "Bài TOML"\ndate = 2020-01-02T10:00:00+07:00\ntags = ["a", "b"]\ncategories = ["KHCN"]\ndescription = "Mô tả"\n+++\n\nThân',
    );
    expect(d).toMatchObject({
      title: 'Bài TOML',
      excerpt: 'Mô tả',
      tags: ['a', 'b'],
      category: 'KHCN',
      bodyMd: 'Thân',
    });
    expect(d.date?.toISOString()).toBe('2020-01-02T03:00:00.000Z');
    expect(() => parseMarkdown('+++\ntitle = \n+++\nx')).toThrow(
      /YAML|front matter/i,
    );
  });

  it('never evaluates JS front matter', () => {
    expect(() =>
      parseMarkdown('---js\n({title: process.exit(1)})\n---\nx'),
    ).toThrow(/JS/);
  });

  it('rejects broken YAML', () => {
    expect(() => parseMarkdown('---\ntitle: [unclosed\n---\nx')).toThrow(
      /YAML/,
    );
  });
});

function zipOf(files: Record<string, string | Buffer>) {
  const z = new AdmZip();
  for (const [name, data] of Object.entries(files))
    z.addFile(name, Buffer.isBuffer(data) ? data : Buffer.from(data));
  return z.toBuffer();
}

describe('readZip', () => {
  it('finds the markdown file and images, skipping macOS junk', () => {
    const r = readZip(
      zipOf({
        'post/index.md': '# Hi',
        'post/img/a.png': 'PNG',
        '__MACOSX/post/._index.md': 'x',
        'post/.DS_Store': 'x',
      }),
    );
    expect(r.mdName).toBe('post/index.md');
    expect([...r.images.keys()]).toEqual(['post/img/a.png']);
  });

  it('rejects path traversal, empty and non-zip input', () => {
    // adm-zip sanitises names when building, so patch the raw bytes (same length) to get a real traversal entry.
    const evil = Buffer.from(
      zipOf({ 'xx/evil.md': 'x' }).toString('latin1').split('xx/').join('../'),
      'latin1',
    );
    expect(() => readZip(evil)).toThrow(/không an toàn/);
    expect(() => readZip(zipOf({ 'a.png': 'x' }))).toThrow(/\.md/);
    expect(() => readZip(Buffer.from('not a zip'))).toThrow(/không hợp lệ/);
  });
});

describe('rewriteImages', () => {
  const images = new Map([
    ['post/img/a b.png', Buffer.from('1')],
    ['post/img/c.png', Buffer.from('2')],
  ]);
  const resolve = async (p: string) => `https://cdn/${p.split('/').pop()}`;

  it('rewrites relative links (url-encoded, ./, and moved folders), keeps absolute and reports missing', async () => {
    const md =
      '![A](img/a%20b.png) ![C](./c.png "t") ![ext](https://x/y.png) ![no](nope.png)';
    const r = await rewriteImages(md, 'post/index.md', images, resolve);
    expect(r.md).toBe(
      '![A](https://cdn/a b.png) ![C](https://cdn/c.png "t") ![ext](https://x/y.png) ![no](nope.png)',
    );
    expect(r.missing).toEqual(['nope.png']);
  });

  it('uploads each distinct image once', async () => {
    const calls: string[] = [];
    await rewriteImages(
      '![](img/c.png) ![](img/c.png)',
      'post/index.md',
      images,
      async (p) => (calls.push(p), 'u'),
    );
    expect(calls).toEqual(['post/img/c.png']);
  });
});
