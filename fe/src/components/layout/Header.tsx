import Link from 'next/link';
import { t } from '@/lib/i18n';
import type { SiteInfo } from '@/lib/types';
import { NavLinks } from './NavLinks';
import { ThemeToggle } from './ThemeToggle';

export function Header({ site }: { site: SiteInfo }) {
  return (
    <header className="mx-auto max-w-measure px-4">
      <nav aria-label={t('nav.main')} className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-b border-border py-5">
        <NavLinks items={site.nav} />
        <Link href="/search" aria-label={t('nav.search')} title={t('nav.search')} className="text-muted hover:text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </Link>
        <a href="/rss.xml" aria-label="RSS" title="RSS" className="text-muted hover:text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
            <circle cx="5" cy="19" r="1.2" fill="currentColor" />
          </svg>
        </a>
        <ThemeToggle />
      </nav>
    </header>
  );
}
