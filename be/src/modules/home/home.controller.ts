import { Controller, Get } from '@nestjs/common';
import { publicWhere } from '../../common/public';
import {
  noteInclude,
  postInclude,
  toNote,
  toPostSummary,
} from '../../common/serializers';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('home')
export class HomeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get() {
    const [featuredPosts, featuredSeries, recentPosts, recentNotes] =
      await Promise.all([
        this.prisma.post.findMany({
          where: { ...publicWhere(), kind: 'POST', featured: true },
          orderBy: { publishedAt: 'desc' },
          include: postInclude,
        }),
        this.prisma.series.findMany({
          where: { featured: true },
          orderBy: { featuredOrder: 'asc' },
          select: {
            slug: true,
            title: true,
            description: true,
            coverUrl: true,
          },
        }),
        this.prisma.post.findMany({
          where: { ...publicWhere(), kind: 'POST' },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          include: postInclude,
        }),
        this.prisma.note.findMany({
          where: publicWhere(),
          orderBy: { publishedAt: 'desc' },
          take: 3,
          include: noteInclude,
        }),
      ]);
    return {
      data: {
        featured: {
          posts: featuredPosts.map(toPostSummary),
          series: featuredSeries,
        },
        recentPosts: recentPosts.map(toPostSummary),
        recentNotes: recentNotes.map(toNote),
      },
    };
  }
}
