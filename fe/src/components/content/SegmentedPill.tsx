'use client';

import Link from 'next/link';

export interface PillItem {
  key: string;
  label: string;
  active: boolean;
  href?: string;
}

/** Segmented pill filter: renders links when items have href, otherwise buttons calling onSelect. */
export function SegmentedPill({ items, onSelect, label }: { items: PillItem[]; onSelect?: (key: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-border bg-surface-note p-0.5 text-sm">
      {items.map((item) => {
        const cls = `rounded-full px-4 py-1 ${item.active ? 'bg-bg font-semibold text-fg shadow-sm' : 'text-muted hover:text-fg'}`;
        return item.href ? (
          <Link key={item.key} href={item.href} aria-current={item.active ? 'true' : undefined} className={cls}>
            {item.label}
          </Link>
        ) : (
          <button key={item.key} type="button" aria-pressed={item.active} onClick={() => onSelect?.(item.key)} className={cls}>
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
