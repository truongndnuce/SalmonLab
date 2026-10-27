/** Domain events emitted by admin services; the revalidate listener turns them into Next cache tags. */
export const Events = {
  PostPublished: 'post.published',
  PostUpdated: 'post.updated',
  NotePublished: 'note.published',
  NoteUpdated: 'note.updated',
  SeriesUpdated: 'series.updated',
  PageUpdated: 'page.updated',
  TaxonomyUpdated: 'taxonomy.updated',
  SiteUpdated: 'site.updated',
} as const;

export interface PostEvent {
  slug: string;
  kind: 'POST' | 'INFOGRAPHIC';
}
export interface SlugEvent {
  slug: string;
}
