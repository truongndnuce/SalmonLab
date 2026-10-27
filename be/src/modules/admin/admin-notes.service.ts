import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError, notFound } from '../../common/errors/app-error';
import { Events } from '../../common/events';
import { meta, paginate } from '../../common/public';
import { noteInclude, toNote } from '../../common/serializers';
import { upsertTagIds } from '../../common/tags';
import { noteSlug } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';

const baseFields = z.object({
  title: z.string().nullable(),
  bodyMd: z.string().trim().min(1),
  categoryId: z.string().nullable(),
  tags: z.array(z.string()),
});
export const createNoteSchema = baseFields
  .partial()
  .required({ bodyMd: true })
  .extend({ publish: z.boolean().default(false) });
export const updateNoteSchema = baseFields.partial();
export const scheduleNoteSchema = z.object({ publishedAt: z.coerce.date() });
export const listAdminNotesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export type CreateNote = z.infer<typeof createNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type ListAdminNotesQuery = z.infer<typeof listAdminNotesQuery>;

@Injectable()
export class AdminNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: ListAdminNotesQuery) {
    const where: Prisma.NoteWhereInput = query.status
      ? { status: query.status }
      : {};
    const [rows, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: noteInclude,
        ...paginate(query.page, query.pageSize),
      }),
      this.prisma.note.count({ where }),
    ]);
    return {
      data: rows.map(toNote),
      meta: meta(query.page, query.pageSize, total),
    };
  }

  async get(id: string) {
    return { data: toNote(await this.find(id)) };
  }

  async create(dto: CreateNote, authorId: string) {
    const tagIds = dto.tags ? await upsertTagIds(this.prisma, dto.tags) : [];
    const now = new Date();
    const note = await this.prisma.note.create({
      data: {
        slug: await this.newSlug(now),
        title: dto.title,
        bodyMd: dto.bodyMd,
        categoryId: dto.categoryId,
        authorId,
        status: dto.publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: dto.publish ? now : null,
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      include: noteInclude,
    });
    if (dto.publish)
      this.events.emit(Events.NotePublished, { slug: note.slug });
    return { data: toNote(note) };
  }

  async update(id: string, dto: UpdateNote) {
    const existing = await this.find(id);
    const { tags, ...fields } = dto;
    const tagIds = tags ? await upsertTagIds(this.prisma, tags) : undefined;
    const note = await this.prisma.note.update({
      where: { id },
      data: {
        ...fields,
        ...(tagIds && {
          tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tagId })) },
        }),
      },
      include: noteInclude,
    });
    this.notifyIfPublic(existing);
    return { data: toNote(note) };
  }

  async publish(id: string) {
    const existing = await this.find(id);
    const keepDate = existing.publishedAt && existing.publishedAt <= new Date();
    const note = await this.prisma.note.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        publishedAt: keepDate ? existing.publishedAt : new Date(),
      },
      include: noteInclude,
    });
    this.events.emit(Events.NotePublished, { slug: note.slug });
    return { data: toNote(note) };
  }

  async unpublish(id: string) {
    const existing = await this.find(id);
    const note = await this.prisma.note.update({
      where: { id },
      data: { status: 'DRAFT' },
      include: noteInclude,
    });
    this.notifyIfPublic(existing);
    return { data: toNote(note) };
  }

  async schedule(id: string, publishedAt: Date) {
    if (publishedAt <= new Date()) {
      throw new AppError(
        'SCHEDULE_IN_PAST',
        'publishedAt must be in the future; use publish instead',
      );
    }
    await this.find(id);
    const note = await this.prisma.note.update({
      where: { id },
      data: { status: 'PUBLISHED', publishedAt },
      include: noteInclude,
    });
    return { data: toNote(note) };
  }

  async remove(id: string) {
    const existing = await this.find(id);
    await this.prisma.note.delete({ where: { id } });
    this.notifyIfPublic(existing);
  }

  private async find(id: string) {
    const note = await this.prisma.note.findUnique({
      where: { id },
      include: noteInclude,
    });
    if (!note) throw notFound('NOTE_NOT_FOUND', `Note "${id}" not found`);
    return note;
  }

  private async newSlug(at: Date) {
    for (let i = 0; i < 5; i++) {
      const slug = noteSlug(at);
      if ((await this.prisma.note.count({ where: { slug } })) === 0)
        return slug;
    }
    throw new AppError(
      'SLUG_GENERATION_FAILED',
      'Could not generate a unique note slug',
      500,
    );
  }

  private notifyIfPublic(before: { status: string; slug: string }) {
    if (before.status === 'PUBLISHED')
      this.events.emit(Events.NoteUpdated, { slug: before.slug });
  }
}
