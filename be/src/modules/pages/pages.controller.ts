import { Controller, Get, Param } from '@nestjs/common';
import { notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('pages')
export class PagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw notFound('PAGE_NOT_FOUND', `Page "${slug}" not found`);
    return { data: { ...page, updatedAt: page.updatedAt.toISOString() } };
  }
}
