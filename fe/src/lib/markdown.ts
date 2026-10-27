import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import rehypeShiki from '@shikijs/rehype';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import type { Element, Root } from 'hast';
import { toString } from 'hast-util-to-string';
import { remarkWidgets } from './widget-directive';

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

/**
 * Collects h2/h3 headings. Runs after rehype-slug so ids exist. Sanitizing happens before
 * slug/autolink/shiki, so the ids and highlighting we generate are never stripped.
 */
function collectToc(toc: TocItem[]) {
  return () => (tree: Root) => {
    const walk = (node: Root | Element) => {
      for (const child of node.children) {
        if (child.type !== 'element') continue;
        if ((child.tagName === 'h2' || child.tagName === 'h3') && child.properties?.id) {
          toc.push({
            id: String(child.properties.id),
            text: toString(child).replace(/#$/, '').trim(),
            depth: child.tagName === 'h2' ? 2 : 3,
          });
        } else {
          walk(child);
        }
      }
    };
    walk(tree);
  };
}

// Raw HTML in Markdown is not rendered (no rehype-raw); sanitize is a second line of defence.
// Heading ids come from rehype-slug and footnote ids from remark-rehype, so no clobbering is needed.
const widgetAttrs = ['className', 'dataWidgetSrc', 'dataWidgetTitle', 'dataWidgetHeight'];
const schema = {
  ...defaultSchema,
  clobber: [],
  clobberPrefix: '',
  tagNames: [...(defaultSchema.tagNames ?? []), 'figure', 'figcaption'],
  // Only the placeholder attributes; the iframe itself is created client-side by WidgetRuntime, never from HTML.
  attributes: { ...defaultSchema.attributes, figure: widgetAttrs },
};

export async function renderMarkdown(md: string): Promise<{ html: string; toc: TocItem[] }> {
  const toc: TocItem[] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkDirective)
    .use(remarkWidgets)
    .use(remarkRehype, { clobberPrefix: '', footnoteLabel: 'Chú thích', footnoteBackLabel: 'Quay lại nội dung' })
    .use(rehypeSanitize, schema)
    .use(rehypeShiki, { themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false, fallbackLanguage: 'text' })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: { className: ['heading-anchor'], ariaLabel: 'Liên kết tới mục này' },
      content: { type: 'text', value: '#' },
    })
    .use(rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] })
    .use(collectToc(toc))
    .use(rehypeStringify)
    .process(md);
  return { html: String(file), toc };
}
