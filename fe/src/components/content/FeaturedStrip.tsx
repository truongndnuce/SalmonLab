import Link from 'next/link';

export interface FeaturedItem {
  href: string;
  title: string;
  kicker: string;
}

export function FeaturedStrip({ items }: { items: FeaturedItem[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="block h-full rounded-card border border-border bg-gradient-to-b from-surface to-bg p-5 shadow-[0_1px_2px_rgba(41,39,36,0.05)] hover:border-accent"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{item.kicker}</span>
            <span className="mt-2 block font-bold leading-snug">{item.title}</span>
            <span aria-hidden className="mt-3 block h-[3px] w-7 bg-highlight" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
