import { Prose } from '@/components/content/Prose';
import { api, apiOrNotFound } from '@/lib/api-client';
import { buildMetadata } from '@/lib/seo';
import type { PageData, SiteInfo } from '@/lib/types';

const tags = ['page:about'];

export async function generateMetadata() {
  const [{ data: page }, { data: site }] = await Promise.all([
    apiOrNotFound<PageData>('/pages/about', { tags }),
    api<SiteInfo>('/site', { tags: ['site'] }),
  ]);
  return buildMetadata({ title: page.title, path: '/about', description: site.tagline, siteName: site.name });
}

export default async function AboutPage() {
  const { data: page } = await apiOrNotFound<PageData>('/pages/about', { tags });
  return (
    <>
      <h1 className="mb-6 text-[32px] font-bold">{page.title}</h1>
      <Prose md={page.bodyMd} />
    </>
  );
}
