import type { MetadataRoute } from 'next';
import { api } from '@/lib/api-client';
import { SITE_URL } from '@/lib/env';
import type { SitemapEntry } from '@/lib/types';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await api<SitemapEntry[]>('/feed/sitemap', { tags: ['feed'] });
  return data.map((e) => ({ url: `${SITE_URL}${e.path}`, lastModified: e.lastModified ?? undefined }));
}
