import type { TocItem } from '@/lib/markdown';

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length < 3) return null;
  return (
    <nav aria-label="Mục lục" className="my-8 rounded-card border border-border bg-surface p-5 text-[15px]">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">Mục lục</p>
      <ol className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className={item.depth === 3 ? 'ml-4' : undefined}>
            <a href={`#${item.id}`} className="text-muted hover:text-accent">
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
