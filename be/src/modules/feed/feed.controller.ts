import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { publicWhere } from '../../common/public';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Controller('feed')
export class FeedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  /** JSON for the web app to render RSS 2.0 XML. */
  @Get('rss')
  async rss() {
    const posts = await this.prisma.post.findMany({
      where: publicWhere(),
      orderBy: { publishedAt: 'desc' },
      take: 50,
      select: {
        slug: true,
        kind: true,
        title: true,
        excerpt: true,
        bodyMd: true,
        publishedAt: true,
        category: { select: { name: true } },
      },
    });
    const site = await this.settings.getSite();
    return {
      data: {
        title: site.name,
        description: site.tagline,
        link: this.config.get<string>('WEB_BASE_URL'),
        items: posts.map((p) => ({
          title: p.title,
          path: `${p.kind === 'POST' ? '/posts' : '/infographic'}/${p.slug}`,
          description: p.excerpt,
          bodyMd: p.bodyMd,
          category: p.category?.name ?? null,
          publishedAt: p.publishedAt!.toISOString(),
        })),
      },
    };
  }

  @Get('sitemap')
  async sitemap() {
    const [posts, notes, series, pages] = await Promise.all([
      this.prisma.post.findMany({
        where: publicWhere(),
        select: { slug: true, kind: true, updatedAt: true },
      }),
      this.prisma.note.findMany({
        where: publicWhere(),
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.series.findMany({ select: { slug: true } }),
      this.prisma.page.findMany({ select: { slug: true, updatedAt: true } }),
    ]);
    const entry = (path: string, lastModified?: Date) => ({
      path,
      lastModified: lastModified?.toISOString() ?? null,
    });
    return {
      data: [
        entry('/'),
        entry('/posts'),
        entry('/notes'),
        entry('/infographic'),
        ...posts.map((p) =>
          entry(
            `${p.kind === 'POST' ? '/posts' : '/infographic'}/${p.slug}`,
            p.updatedAt,
          ),
        ),
        ...notes.map((n) => entry(`/notes/${n.slug}`, n.updatedAt)),
        ...series.map((s) => entry(`/series/${s.slug}`)),
        ...pages.map((p) => entry(`/${p.slug}`, p.updatedAt)),
      ],
    };
  }
}
