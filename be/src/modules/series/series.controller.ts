import { Controller, Get, Param } from '@nestjs/common';
import { notFound } from '../../common/errors/app-error';
import { publicWhere } from '../../common/public';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('series')
export class SeriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    const series = await this.prisma.series.findUnique({ where: { slug } });
    if (!series)
      throw notFound('SERIES_NOT_FOUND', `Series "${slug}" not found`);
    const items = await this.prisma.post.findMany({
      where: { ...publicWhere(), seriesId: series.id },
      orderBy: { seriesOrder: 'asc' },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        kind: true,
        publishedAt: true,
        seriesOrder: true,
      },
    });
    const { createdAt, ...rest } = series;
    return { data: { ...rest, createdAt: createdAt.toISOString(), items } };
  }
}
