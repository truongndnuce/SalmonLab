import { api } from '@/lib/api-client';
import { SITE_URL } from '@/lib/env';
import type { FeedRss } from '@/lib/types';

export const revalidate = 3600;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET() {
  const { data: feed } = await api<FeedRss>('/feed/rss', { tags: ['feed'] });
  const items = feed.items
    .map((i) => {
      const url = `${SITE_URL}${i.path}`;
      return `<item><title>${esc(i.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(i.publishedAt).toUTCString()}</pubDate>${i.category ? `<category>${esc(i.category)}</category>` : ''}${i.description ? `<description>${esc(i.description)}</description>` : ''}</item>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${esc(feed.title)}</title><link>${SITE_URL}</link><description>${esc(feed.description)}</description><language>vi</language><atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
