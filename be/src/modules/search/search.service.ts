import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { meta } from '../../common/public';
import { PrismaService } from '../../prisma/prisma.service';
import { fold, makeSnippet, searchTerms } from './snippet';

export const searchQuery = z.object({
  q: z.string().trim().min(2, 'Từ khoá cần ít nhất 2 ký tự').max(100),
  type: z.enum(['all', 'post', 'infographic', 'note']).default('all'),
  page: z.coerce.number().int().min(1).max(50).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(10),
});
export type SearchQuery = z.infer<typeof searchQuery>;

interface Row {
  type: 'post' | 'infographic' | 'note';
  slug: string;
  title: string | null;
  excerpt: string | null;
  body: string;
  publishedAt: Date;
  rank: number;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, '\\$&');

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search({ q, type, page, pageSize }: SearchQuery) {
    const terms = searchTerms(q);
    if (terms.length === 0) return { data: [], meta: meta(page, pageSize, 0) };

    // Terms contain only letters/digits, so the prefix query ("dien:* & toan:*") can't carry tsquery syntax.
    const tsq = terms.map((t) => `${t}:*`).join(' & ');
    const like = `%${escapeLike(fold(q).replace(/\s+/g, ' '))}%`;
    const withPosts = type !== 'note';
    const withNotes = type === 'all' || type === 'note';
    const kindFilter =
      type === 'post'
        ? Prisma.sql`AND p.kind = 'POST'`
        : type === 'infographic'
          ? Prisma.sql`AND p.kind = 'INFOGRAPHIC'`
          : Prisma.empty;

    const postSelect = Prisma.sql`
      SELECT CASE WHEN p.kind = 'INFOGRAPHIC' THEN 'infographic' ELSE 'post' END AS type, p.slug, p.title, p.excerpt,
             p."bodyMd" AS body, p."publishedAt",
             ts_rank(search_doc(p.title, p.excerpt, p."bodyMd"), query.tsq)
               + CASE WHEN f_unaccent(p.title) LIKE ${like} ESCAPE '\\' THEN 1 ELSE 0 END AS rank
      FROM "Post" p, query
      WHERE p.status = 'PUBLISHED' AND p."publishedAt" <= now() ${kindFilter}
        AND (search_doc(p.title, p.excerpt, p."bodyMd") @@ query.tsq OR f_unaccent(p.title) LIKE ${like} ESCAPE '\\')`;
    const noteSelect = Prisma.sql`
      SELECT 'note' AS type, n.slug, NULL::text AS title, NULL::text AS excerpt, n."bodyMd" AS body, n."publishedAt",
             ts_rank(search_doc(NULL, NULL, n."bodyMd"), query.tsq) AS rank
      FROM "Note" n, query
      WHERE n.status = 'PUBLISHED' AND n."publishedAt" <= now()
        AND search_doc(NULL, NULL, n."bodyMd") @@ query.tsq`;

    const parts = [withPosts && postSelect, withNotes && noteSelect].filter(
      Boolean,
    ) as Prisma.Sql[];
    const union = Prisma.join(parts, ' UNION ALL ');
    const cte = Prisma.sql`WITH query AS (SELECT to_tsquery('simple', ${tsq}) AS tsq)`;

    const [rows, count] = await Promise.all([
      this.prisma.$queryRaw<
        Row[]
      >`${cte} SELECT * FROM (${union}) r ORDER BY rank DESC, "publishedAt" DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      this.prisma.$queryRaw<
        { n: bigint }[]
      >`${cte} SELECT count(*) AS n FROM (${union}) r`,
    ]);

    const data = rows.map((r) => ({
      type: r.type,
      slug: r.slug,
      title: r.title ?? makeSnippet(r.body, [], 70),
      excerpt: r.excerpt,
      snippet: makeSnippet(r.body, terms),
      publishedAt: r.publishedAt,
    }));
    return { data, meta: meta(page, pageSize, Number(count[0].n)) };
  }
}
