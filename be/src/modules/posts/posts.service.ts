import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { notFound } from '../../common/errors/app-error';
import { meta, paginate, publicWhere } from '../../common/public';
import { dateRange } from '../../common/public';
import { postInclude, toPost, toPostSummary } from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

export const listPostsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
  category: z.string().optional(),
  tag: z.string().optional(),
  year: z.coerce.number().int().min(1970).max(2100).optional(),
  // Infographics have their own section, so /posts lists regular posts unless asked otherwise.
  kind: z.enum(['post', 'infographic']).default('post'),
  q: z.string().trim().min(1).optional(),
  fields: z.enum(['slug']).optional(),
});
export type ListPostsQuery = z.infer<typeof listPostsQuery>;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListPostsQuery) {
    const where: Prisma.PostWhereInput = {
      ...publicWhere(),
      kind:
        query.kind === 'post' ? ('POST' as const) : ('INFOGRAPHIC' as const),
      ...(query.category && { category: { slug: query.category } }),
      ...(query.tag && { tags: { some: { tag: { slug: query.tag } } } }),
      ...(query.year && {
        publishedAt: { ...dateRange(query.year), lte: new Date() },
      }),
      ...(query.q && {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { excerpt: { contains: query.q, mode: 'insensitive' } },
        ],
      }),
    };
    const orderBy = [{ publishedAt: 'desc' as const }, { id: 'desc' as const }];

    if (query.fields === 'slug') {
      const [rows, total] = await Promise.all([
        this.prisma.post.findMany({
          where,
          orderBy,
          select: { slug: true },
          ...paginate(query.page, query.pageSize),
        }),
        this.prisma.post.count({ where }),
      ]);
      return { data: rows, meta: meta(query.page, query.pageSize, total) };
    }

    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy,
        include: postInclude,
        ...paginate(query.page, query.pageSize),
      }),
      this.prisma.post.count({ where }),
    ]);
    return {
      data: rows.map(toPostSummary),
      meta: meta(query.page, query.pageSize, total),
    };
  }

  /** Where a renamed post moved to, so the web app can answer the old URL with a permanent redirect. */
  async redirectFor(section: string, slug: string) {
    const r = await this.prisma.slugRedirect.findUnique({
      where: { section_oldSlug: { section, oldSlug: slug } },
    });
    if (!r) throw notFound('REDIRECT_NOT_FOUND', 'No redirect for this slug');
    return { data: { slug: r.newSlug } };
  }

  async bySlug(slug: string, kind: 'POST' | 'INFOGRAPHIC') {
    const post = await this.prisma.post.findFirst({
      where: { slug, kind, ...publicWhere() },
      include: postInclude,
    });
    if (!post) throw notFound('POST_NOT_FOUND', `Post "${slug}" not found`);

    const sameKind = { ...publicWhere(), kind: post.kind };
    const [prev, next, seriesPosts] = await Promise.all([
      this.prisma.post.findFirst({
        where: {
          ...sameKind,
          publishedAt: { lt: post.publishedAt!, lte: new Date() },
        },
        orderBy: { publishedAt: 'desc' },
        select: { slug: true, title: true },
      }),
      this.prisma.post.findFirst({
        where: {
          ...sameKind,
          publishedAt: { gt: post.publishedAt!, lte: new Date() },
        },
        orderBy: { publishedAt: 'asc' },
        select: { slug: true, title: true },
      }),
      post.seriesId
        ? this.prisma.post.findMany({
            where: { ...publicWhere(), seriesId: post.seriesId },
            orderBy: { seriesOrder: 'asc' },
            select: { slug: true, title: true, seriesOrder: true },
          })
        : Promise.resolve([]),
    ]);

    return { data: { ...toPost(post), prev, next, seriesPosts } };
  }
}
