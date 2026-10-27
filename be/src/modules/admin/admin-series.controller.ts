import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { AdminController } from '../../auth/decorators';
import { AppError, notFound } from '../../common/errors/app-error';
import { Events } from '../../common/events';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { slugifyVi, uniqueSlug } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';

const fields = z.object({
  title: z.string().trim().min(1),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  featured: z.boolean(),
  featuredOrder: z.number().int().nullable(),
});
const createSchema = fields.partial().required({ title: true });
const updateSchema = fields.partial();
const orderSchema = z.object({ postIds: z.array(z.string()).min(1) });

@AdminController('series')
export class AdminSeriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  async list() {
    const rows = await this.prisma.series.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { posts: true } } },
    });
    return {
      data: rows.map(({ _count, ...s }) => ({ ...s, postCount: _count.posts })),
    };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const series = await this.prisma.series.findUnique({
      where: { id },
      include: {
        posts: {
          orderBy: { seriesOrder: 'asc' },
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            seriesOrder: true,
          },
        },
      },
    });
    if (!series) throw notFound('SERIES_NOT_FOUND', `Series "${id}" not found`);
    return { data: series };
  }

  @Post()
  async create(
    @Body(new ZodPipe(createSchema)) dto: z.infer<typeof createSchema>,
  ) {
    const slug =
      dto.slug ??
      (await uniqueSlug(
        slugifyVi(dto.title) || 'series',
        async (s) =>
          (await this.prisma.series.count({ where: { slug: s } })) > 0,
      ));
    const series = await this.prisma.series.create({ data: { ...dto, slug } });
    this.events.emit(Events.SeriesUpdated, { slug });
    return { data: series };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateSchema)) dto: z.infer<typeof updateSchema>,
  ) {
    const series = await this.prisma.series.update({
      where: { id },
      data: dto,
    });
    this.events.emit(Events.SeriesUpdated, { slug: series.slug });
    return { data: series };
  }

  /** Sets seriesOrder to 1..n following `postIds`; posts listed are also attached to this series. */
  @Put(':id/order')
  async order(
    @Param('id') id: string,
    @Body(new ZodPipe(orderSchema)) body: z.infer<typeof orderSchema>,
  ) {
    const series = await this.prisma.series.findUnique({ where: { id } });
    if (!series) throw notFound('SERIES_NOT_FOUND', `Series "${id}" not found`);
    if (new Set(body.postIds).size !== body.postIds.length)
      throw new AppError('DUPLICATE_POST_IDS', 'postIds must be unique');
    const found = await this.prisma.post.count({
      where: { id: { in: body.postIds } },
    });
    if (found !== body.postIds.length)
      throw notFound('POST_NOT_FOUND', 'Some posts do not exist');
    await this.prisma.$transaction(
      body.postIds.map((postId, i) =>
        this.prisma.post.update({
          where: { id: postId },
          data: { seriesId: id, seriesOrder: i + 1 },
        }),
      ),
    );
    this.events.emit(Events.SeriesUpdated, { slug: series.slug });
    return this.get(id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const series = await this.prisma.series.delete({ where: { id } });
    this.events.emit(Events.SeriesUpdated, { slug: series.slug });
  }
}
