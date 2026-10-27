export type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Taxon {
  id: string;
  slug: string;
  name: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AdminPost {
  id: string;
  kind: 'POST' | 'INFOGRAPHIC';
  slug: string;
  title: string;
  excerpt: string | null;
  bodyMd?: string;
  coverUrl: string | null;
  coverAlt: string | null;
  status: Status;
  publishedAt: string | null;
  wordCount: number;
  readingMins: number;
  featured: boolean;
  category: Taxon | null;
  tags: Taxon[];
  series: { id: string; slug: string; title: string } | null;
  seriesOrder: number | null;
  updatedAt: string;
}

export interface AdminNote {
  id: string;
  slug: string;
  title: string | null;
  bodyMd: string;
  status: Status;
  publishedAt: string | null;
  tags: Taxon[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminSeries {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  featured: boolean;
  featuredOrder: number | null;
  postCount?: number;
  posts?: { id: string; slug: string; title: string; status: Status; seriesOrder: number | null }[];
}

export interface AdminPage {
  id: string;
  slug: string;
  title: string;
  bodyMd: string;
}

export interface ApiMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** Scheduled = published with a publish time still in the future. */
export function displayStatus(status: Status, publishedAt: string | null): 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' {
  if (status === 'PUBLISHED' && publishedAt && new Date(publishedAt) > new Date()) return 'SCHEDULED';
  return status;
}

export interface AdminMedia {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  createdAt: string;
}

export interface AdminWidget {
  id: string;
  name: string;
  title: string;
  url: string;
  size: number;
}
