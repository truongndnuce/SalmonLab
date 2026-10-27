import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { notFound } from '../../common/errors/app-error';
import { dateRange, meta, paginate, publicWhere } from '../../common/public';
import { noteInclude, toNote } from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

export const listNotesQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  year: z.coerce.number().int().min(1970).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  tag: z.string().optional(),
});
export type ListNotesQuery = z.infer<typeof listNotesQuery>;

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListNotesQuery) {
    // A month without a year is ambiguous, so it is ignored.
    const where: Prisma.NoteWhereInput = {
      ...publicWhere(),
      ...(query.year && {
        publishedAt: { ...dateRange(query.year, query.month), lte: new Date() },
      }),
      ...(query.tag && { tags: { some: { tag: { slug: query.tag } } } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.note.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
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

  /** Years and months (Vietnam time) that have public notes, newest first; feeds the year/month filter. */
  async archive() {
    const rows = await this.prisma.$queryRaw<{ year: number; month: number }[]>`
      SELECT DISTINCT
        EXTRACT(YEAR FROM ("publishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS year,
        EXTRACT(MONTH FROM ("publishedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS month
      FROM "Note"
      WHERE status = 'PUBLISHED' AND "publishedAt" <= now()
      ORDER BY year DESC, month DESC`;
    const byYear = new Map<number, number[]>();
    for (const { year, month } of rows)
      byYear.set(year, [...(byYear.get(year) ?? []), month]);
    return { data: [...byYear].map(([year, months]) => ({ year, months })) };
  }

  async bySlug(slug: string) {
    const note = await this.prisma.note.findFirst({
      where: { slug, ...publicWhere() },
      include: noteInclude,
    });
    if (!note) throw notFound('NOTE_NOT_FOUND', `Note "${slug}" not found`);
    return { data: toNote(note) };
  }
}
