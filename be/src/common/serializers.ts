import { Prisma } from '@prisma/client';

export const postInclude = {
  category: true,
  tags: { include: { tag: true } },
  series: true,
} satisfies Prisma.PostInclude;

export const noteInclude = {
  category: true,
  tags: { include: { tag: true } },
} satisfies Prisma.NoteInclude;

type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;
type NoteRow = Prisma.NoteGetPayload<{ include: typeof noteInclude }>;

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const pickTaxon = (t: { id: string; slug: string; name: string } | null) =>
  t && { id: t.id, slug: t.slug, name: t.name };

/** List view: omits the (large) Markdown body. */
export function toPostSummary(p: PostRow) {
  return {
    id: p.id,
    kind: p.kind,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverUrl: p.coverUrl,
    coverAlt: p.coverAlt,
    status: p.status,
    publishedAt: iso(p.publishedAt),
    wordCount: p.wordCount,
    readingMins: p.readingMins,
    featured: p.featured,
    category: pickTaxon(p.category),
    tags: p.tags.map((t) => pickTaxon(t.tag)),
    series: p.series && {
      id: p.series.id,
      slug: p.series.slug,
      title: p.series.title,
      description: p.series.description,
      coverUrl: p.series.coverUrl,
      featured: p.series.featured,
      featuredOrder: p.series.featuredOrder,
    },
    seriesOrder: p.seriesOrder,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const toPost = (p: PostRow) => ({
  ...toPostSummary(p),
  bodyMd: p.bodyMd,
});

export function toNote(n: NoteRow) {
  return {
    id: n.id,
    slug: n.slug,
    title: n.title,
    bodyMd: n.bodyMd,
    status: n.status,
    publishedAt: iso(n.publishedAt),
    category: pickTaxon(n.category),
    tags: n.tags.map((t) => pickTaxon(t.tag)),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}
