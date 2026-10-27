import type { Metadata } from 'next';
import { SITE_URL } from './env';

interface Input {
  title?: string;
  description?: string | null;
  /** Path starting with "/", used for the canonical URL. */
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  siteName: string;
  noindex?: boolean;
}

export function buildMetadata({ title, description, path, image, type = 'website', publishedTime, modifiedTime, siteName, noindex }: Input): Metadata {
  const url = `${SITE_URL}${path}`;
  const images = image ? [{ url: image }] : undefined;
  return {
    // Omit rather than pass undefined, which would override the layout's default title.
    ...(title && { title }),
    description: description ?? undefined,
    alternates: { canonical: url },
    robots: noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      type,
      locale: 'vi_VN',
      siteName,
      url,
      title: title ?? siteName,
      description: description ?? undefined,
      images,
      ...(type === 'article' && { publishedTime: publishedTime ?? undefined, modifiedTime: modifiedTime ?? undefined }),
    },
    twitter: { card: 'summary_large_image', title: title ?? siteName, description: description ?? undefined, images: image ? [image] : undefined },
  };
}
