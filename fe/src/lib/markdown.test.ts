import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('builds a TOC from h2/h3 with Vietnamese-friendly ids and ignores deeper headings', async () => {
    const { html, toc } = await renderMarkdown('## Giới thiệu\n\n### Chi tiết\n\n#### Sâu hơn\n\n## Kết luận');
    expect(toc.map((t) => [t.depth, t.text])).toEqual([
      [2, 'Giới thiệu'],
      [3, 'Chi tiết'],
      [2, 'Kết luận'],
    ]);
    for (const t of toc) expect(html).toContain(`id="${t.id}"`);
    expect(html).toContain('class="heading-anchor"');
  });

  it('highlights fenced code with Shiki', async () => {
    const { html } = await renderMarkdown('```ts\nconst a: number = 1;\n```');
    expect(html).toContain('class="shiki');
    expect(html).toContain('style=');
  });

  it('supports GFM tables and footnotes with working anchors', async () => {
    const { html } = await renderMarkdown('| a | b |\n|---|---|\n| 1 | 2 |\n\nCó chú thích[^1].\n\n[^1]: nội dung');
    expect(html).toContain('<table>');
    expect(html).toContain('href="#fn-1"');
    expect(html).toContain('id="fn-1"');
  });

  it('opens external links safely and leaves internal ones alone', async () => {
    const { html } = await renderMarkdown('[ngoài](https://example.com) và [trong](/posts/a)');
    expect(html).toMatch(/href="https:\/\/example.com"[^>]*target="_blank"/);
    expect(html).toMatch(/rel="noopener noreferrer"/);
    expect(html).toMatch(/<a href="\/posts\/a">/);
  });

  it('never emits scripts, event handlers or javascript: URLs', async () => {
    const { html } = await renderMarkdown(
      '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[click](javascript:alert(1))\n\n![x](javascript:alert(1))',
    );
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/javascript:/i);
  });
});

describe('::widget directive', () => {
  const SRC = 'http://localhost:9000/blog-widgets/widgets/p1/demo.html';

  it('renders a placeholder figure with data attributes (the iframe is created client-side)', async () => {
    const { html } = await renderMarkdown(`Trước\n\n::widget{src="${SRC}" height="360" title="Demo" caption="Bấm thử"}\n\nSau`);
    expect(html).toContain('<figure class="widget"');
    expect(html).toContain(`data-widget-src="${SRC}"`);
    expect(html).toContain('data-widget-title="Demo"');
    expect(html).toContain('data-widget-height="360"');
    expect(html).toContain('<figcaption>Bấm thử</figcaption>');
    expect(html).not.toContain('<iframe');
  });

  it('clamps the height and defaults when missing', async () => {
    expect((await renderMarkdown(`::widget{src="${SRC}" height="99999" title="x"}`)).html).toContain('data-widget-height="2000"');
    expect((await renderMarkdown(`::widget{src="${SRC}" title="x"}`)).html).toContain('data-widget-height="400"');
  });

  it('refuses widgets from other origins, path tricks, or without a title', async () => {
    for (const d of [
      '::widget{src="https://evil.example/x.html" title="x"}',
      `::widget{src="${SRC.replace('/p1/', '/../')}" title="x"}`,
      `::widget{src="${SRC}"}`,
    ]) {
      const { html } = await renderMarkdown(d);
      expect(html).toContain('Widget không hợp lệ');
      expect(html).not.toContain('data-widget-src');
    }
  });

  it('keeps other directive-looking text instead of dropping it', async () => {
    const { html } = await renderMarkdown('Giờ họp :clock: lúc 10:30, xem :abbr[HTML]{title="x"} nhé.');
    expect(html).toContain(':clock:');
    expect(html).toContain(':abbr[HTML]{title="x"}');
  });

  it('cannot smuggle attributes via sanitized HTML', async () => {
    const { html } = await renderMarkdown('<figure class="widget" data-widget-src="https://evil/x.html" data-widget-title="x">hi</figure>');
    expect(html).not.toContain('data-widget-src');
  });
});
