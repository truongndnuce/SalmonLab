'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLinks({ items }: { items: { label: string; href: string }[] }) {
  const pathname = usePathname();
  return (
    <>
      {items.map(({ label, href }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`text-[13px] uppercase tracking-[0.14em] hover:text-accent ${active ? 'font-semibold text-fg' : 'text-muted'}`}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
