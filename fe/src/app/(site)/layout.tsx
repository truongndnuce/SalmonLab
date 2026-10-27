import type { Metadata } from 'next';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api-client';
import type { SiteInfo } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const { data: site } = await api<SiteInfo>('/site', { tags: ['site'] });
  return {
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.tagline,
    alternates: { types: { 'application/rss+xml': '/rss.xml' } },
  };
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { data: site } = await api<SiteInfo>('/site', { tags: ['site'] });
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:bg-bg focus:p-2">
        Bỏ qua điều hướng
      </a>
      <Header site={site} />
      <main id="main" className="mx-auto max-w-measure px-4 pt-10">
        {children}
      </main>
      <Footer siteName={site.name} />
    </>
  );
}
