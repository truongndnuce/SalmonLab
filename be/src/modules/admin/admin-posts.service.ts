import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PostKind } from '@salmon/shared';
import { z } from 'zod';
import { AppError, notFound } from '../../common/errors/app-error';
import { Events } from '../../common/events';
import { meta, paginate } from '../../common/public';
import { postInclude, toPost, toPostSummary } from '../../common/serializers';
import { upsertTagIds } from '../../common/tags';
import { readingStats } from '../../common/utils/reading-stats';
import { slugifyVi, uniqueSlug } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';
import { WidgetsService } from '../widgets/widgets.service';

const slugField = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case');
const baseFields = z.object({
  kind: PostKind,
  title: z.string().trim().min(1),
  slug: slugField,
  excerpt: z.string().nullable(),
  bodyMd: z.string(),
  coverUrl: z.string().nullable(),
  coverAlt: z.string().nullable(),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()),
  seriesId: z.string().nullable(),
  seriesOrder: z.number().int().nullable(),
  featured: z.boolean(),
});

export const createPostSchema = baseFields
  .partial()
  .required({ title: true })
  .extend({ bodyMd: z.string().default('') });
export const updatePostSchema = baseFields.partial();
export const schedulePostSchema = z.object({ publishedAt: z.coerce.date() });
export const listAdminPostsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
  kind: PostKind.optional(),
  q: z.string().trim().min(1).optional(),
});

export type CreatePost = z.infer<typeof createPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;
export type ListAdminPostsQuery = z.infer<typeof listAdminPostsQuery>;

@Injectable()
export class AdminPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    private readonly widgets: WidgetsService,
  ) {}

  async list(query: ListAdminPostsQuery) {
    const where: Prisma.PostWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.kind && { kind: query.kind }),
      ...(query.q && { title: { contains: query.q, mode: 'insensitive' } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
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

  async get(id: string) {
    return { data: toPost(await this.find(id)) };
  }

  async create(dto: CreatePost, authorId: string) {
    const slug = dto.slug
      ? await this.assertSlugFree(dto.slug)
      : await uniqueSlug(slugifyVi(dto.title) || 'bai-viet', (s) =>
          this.slugExists(s),
        );
    const tagIds = dto.tags ? await upsertTagIds(this.prisma, dto.tags) : [];
    const post = await this.prisma.post.create({
      data: {
        kind: dto.kind ?? 'POST',
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        bodyMd: dto.bodyMd,
        coverUrl: dto.coverUrl,
        coverAlt: dto.coverAlt,
        categoryId: dto.categoryId,
        seriesId: dto.seriesId,
        seriesOrder: dto.seriesOrder,
        featured: dto.featured ?? false,
        authorId,
        ...readingStats(dto.bodyMd),
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: postInclude,
    });
    return { data: toPost(post) };
  }

  async update(id: string, dto: UpdatePost) {
    const existing = await this.find(id);
    const slugChanged = !!dto.slug && dto.slug !== existing.slug;
    if (slugChanged) await this.assertSlugFree(dto.slug!);
    // Once a URL has been public, keep it working: the old slug redirects (301) to the new one.
    const wasPublic =
      !!existing.publishedAt && existing.publishedAt <= new Date();
    const { tags, ...fields } = dto;
    const tagIds = tags ? await upsertTagIds(this.prisma, tags) : undefined;
    const section =
      (dto.kind ?? existing.kind) === 'POST' ? 'posts' : 'infographic';
    const post = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.post.update({
        where: { id },
        data: {
          ...fields,
          ...(dto.bodyMd !== undefined && readingStats(dto.bodyMd)),
          ...(tagIds && {
            tags: {
              deleteMany: {},
              create: tagIds.map((tagId) => ({ tagId })),
            },
          }),
        },
        include: postInclude,
      });
      if (slugChanged) {
        // The new slug may have been redirected away earlier; it is a real page again.
        await tx.slugRedirect.deleteMany({
          where: { section, oldSlug: updated.slug },
        });
        if (wasPublic) {
          // Collapse chains (a -> b, then b -> c becomes a -> c and b -> c).
          await tx.slugRedirect.updateMany({
            where: { section, newSlug: existing.slug },
            data: { newSlug: updated.slug },
          });
          await tx.slugRedirect.upsert({
            where: { section_oldSlug: { section, oldSlug: existing.slug } },
            create: { section, oldSlug: existing.slug, newSlug: updated.slug },
            update: { newSlug: updated.slug },
          });
        }
      }
      return updated;
    });
    this.notifyIfPublic(existing, post.slug);
    // The old URL now redirects, so its cached 404/page must refresh too.
    if (slugChanged) this.notifyIfPublic(existing, existing.slug);
    return { data: toPost(post) };
  }

  /** Publishes now; an original past publish date is kept so republishing doesn't reorder the archive. */
  async publish(id: string) {
    const existing = await this.find(id);
    const keepDate = existing.publishedAt && existing.publishedAt <= new Date();
    const post = await this.prisma.post.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: keepDate ? existing.publishedAt : new Date(),
      },
      include: postInclude,
    });
    this.events.emit(Events.PostPublished, {
      slug: post.slug,
      kind: post.kind,
    });
    return { data: toPost(post) };
  }

  async unpublish(id: string) {
    const existing = await this.find(id);
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: postInclude,
    });
    this.notifyIfPublic(existing, post.slug);
    return { data: toPost(post) };
  }

  async schedule(id: string, publishedAt: Date) {
    if (publishedAt <= new Date()) {
      throw new AppError(
        'SCHEDULE_IN_PAST',
        'publishedAt must be in the future; use publish instead',
      );
    }
    await this.find(id);
    const post = await this.prisma.post.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt },
      include: postInclude,
    });
    return { data: toPost(post) };
  }

  async remove(id: string) {
    const existing = await this.find(id);
    await this.widgets.removeAllForPost(id);
    // Redirects pointing at a deleted post would only lead to a 404.
    const section = existing.kind === 'POST' ? 'posts' : 'infographic';
    await this.prisma.slugRedirect.deleteMany({
      where: { section, newSlug: existing.slug },
    });
    await this.prisma.post.delete({ where: { id } });
    this.notifyIfPublic(existing, existing.slug);
  }

  private async find(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });
    if (!post) throw notFound('POST_NOT_FOUND', `Post "${id}" not found`);
    return post;
  }

  private async slugExists(slug: string) {
    return (await this.prisma.post.count({ where: { slug } })) > 0;
  }

  private async assertSlugFree(slug: string) {
    if (await this.slugExists(slug))
      throw new AppError('SLUG_TAKEN', `Slug "${slug}" is already used`, 409);
    return slug;
  }

  private notifyIfPublic(
    before: { status: string; kind: 'POST' | 'INFOGRAPHIC' },
    slug: string,
  ) {
    if (before.status === 'PUBLISHED')
      this.events.emit(Events.PostUpdated, { slug, kind: before.kind });
  }
}
