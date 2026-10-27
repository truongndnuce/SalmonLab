import { Controller, Get } from '@nestjs/common';
import { publicWhere } from '../../common/public';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('taxonomy')
export class TaxonomyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('categories')
  async categories() {
    const rows = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: { where: publicWhere() } } } },
    });
    return {
      data: rows.map(({ _count, ...c }) => ({ ...c, postCount: _count.posts })),
    };
  }

  @Get('tags')
  async tags() {
    const rows = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { posts: { where: { post: publicWhere() } } } },
      },
    });
    return {
      data: rows.map(({ _count, ...t }) => ({ ...t, postCount: _count.posts })),
    };
  }
}
