import type { Paragraph, Parents, PhrasingContent, Root, Text } from 'mdast';
import { SKIP, visit } from 'unist-util-visit';

/** Public base URL of the widgets bucket/CDN. Only widgets served from here are embedded. */
export const WIDGETS_BASE_URL = (process.env.WIDGETS_BASE_URL ?? 'http://localhost:9000/blog-widgets').replace(/\/$/, '');

const MIN_HEIGHT = 100;
const MAX_HEIGHT = 2000;
const DEFAULT_HEIGHT = 400;

const text = (value: string): Text => ({ type: 'text', value });
const note = (msg: string): Paragraph => ({ type: 'paragraph', children: [{ type: 'emphasis', children: [text(msg)] }] });

export function isAllowedWidgetSrc(src: string): boolean {
  return src.startsWith(`${WIDGETS_BASE_URL}/`) && !src.includes('..');
}

/**
 * Turns `::widget{src title height caption}` into a <figure class="widget" data-widget-*> placeholder that the
 * client `WidgetRuntime` upgrades to a sandboxed iframe. Any other directive (e.g. `:smile:`) is restored to the
 * literal source text, because remark-rehype would otherwise silently drop it.
 */
export function remarkWidgets() {
  return (tree: Root, file: { value: unknown }) => {
    const source = String(file.value);
    visit(tree, (node, index, parent) => {
      if (node.type !== 'leafDirective' && node.type !== 'textDirective' && node.type !== 'containerDirective') return;
      if (index === undefined || !parent) return;
      const siblings = (parent as Parents).children as (Paragraph | PhrasingContent | typeof node)[];

      if (node.type === 'leafDirective' && node.name === 'widget') {
        const { src = '', title = '', height = '', caption = '' } = (node.attributes ?? {}) as Record<string, string>;
        if (!isAllowedWidgetSrc(src) || !title.trim()) {
          siblings[index] = note('[Widget không hợp lệ: cần src từ kho widget của site và title]');
          return SKIP;
        }
        const h = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number.parseInt(height, 10) || DEFAULT_HEIGHT));
        const children: Paragraph[] = [{ type: 'paragraph', children: [text(`▶ ${title}`)] }];
        if (caption.trim()) {
          const cap: Paragraph = { type: 'paragraph', children: [text(caption)], data: { hName: 'figcaption' } };
          children.push(cap);
        }
        siblings[index] = {
          type: 'paragraph', // placeholder container, rendered as <figure> via hName
          children: children as unknown as PhrasingContent[],
          data: {
            hName: 'figure',
            hProperties: { className: ['widget'], dataWidgetSrc: src, dataWidgetTitle: title.trim(), dataWidgetHeight: String(h) },
          },
        };
        return SKIP;
      }

      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      siblings[index] = text(start !== undefined && end !== undefined ? source.slice(start, end) : '');
      return SKIP;
    });
  };
}
