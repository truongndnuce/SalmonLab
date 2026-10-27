export interface Taxon {
  id: string;
  slug: string;
  name: string;
}

export interface SeriesRef {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
}

/** List view of a post: no Markdown body. */
export interface PostSummary {
  id: string;
  kind: 'POST' | 'INFOGRAPHIC';
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  publishedAt: string;
  wordCount: number;
  readingMins: number;
  featured: boolean;
  category: Taxon | null;
  tags: Taxon[];
  series: SeriesRef | null;
  seriesOrder: number | null;
  updatedAt: string;
}

export interface PostDetail extends PostSummary {
  bodyMd: string;
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  seriesPosts: { slug: string; title: string; seriesOrder: number | null }[];
}

export interface Note {
  id: string;
  slug: string;
  title: string | null;
  bodyMd: string;
  publishedAt: string;
  category: Taxon | null;
  tags: Taxon[];
  updatedAt: string;
}

export interface SiteInfo {
  name: string;
  tagline: string;
  coverUrl: string | null;
  url: string;
  nav: { label: string; href: string }[];
}

export interface HomeData {
  featured: {
    posts: PostSummary[];
    series: { slug: string; title: string; description: string | null; coverUrl: string | null }[];
  };
  recentPosts: PostSummary[];
  recentNotes: Note[];
}

export interface Meta {
  page: number;
  pageSize: number;
  total: number;
}

export interface SeriesDetail {
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  items: { slug: string; title: string; excerpt: string | null; kind: 'POST' | 'INFOGRAPHIC'; publishedAt: string; seriesOrder: number | null }[];
}

export interface PageData {
  slug: string;
  title: string;
  bodyMd: string;
  updatedAt: string;
}

export interface FeedRss {
  title: string;
  description: string;
  link: string;
  items: { title: string; path: string; description: string | null; bodyMd: string; category: string | null; publishedAt: string }[];
}

export interface SitemapEntry {
  path: string;
  lastModified: string | null;
}

export interface ApiOk<T> {
  data: T;
  meta?: Meta;
}

export interface SearchResult {
  type: 'post' | 'infographic' | 'note';
  slug: string;
  title: string;
  excerpt: string | null;
  snippet: string;
  publishedAt: string;
}
