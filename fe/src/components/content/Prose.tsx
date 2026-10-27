import { renderMarkdown } from '@/lib/markdown';
import { WidgetRuntime } from './WidgetRuntime';

/** Renders Markdown through the sanitizing pipeline (see lib/markdown.ts). */
export async function Prose({ md }: { md: string }) {
  const { html } = await renderMarkdown(md);
  return (
    <>
      <div className="prose prose-salmon max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      <WidgetRuntime />
    </>
  );
}
