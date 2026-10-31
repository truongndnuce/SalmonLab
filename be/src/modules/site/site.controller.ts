import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';

@Controller('site')
export class SiteController {
  constructor(
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {}

  @Get()
  async get() {
    const site = await this.settings.getSite();
    return {
      data: {
        name: site.name,
        tagline: site.tagline,
        coverUrl: site.coverUrl,
        url: this.config.get<string>('WEB_BASE_URL'),
        nav: [
          { label: 'Trang chủ', href: '/' },
          { label: 'Bài viết', href: '/posts' },
          { label: 'Ghi chú', href: '/notes' },
          { label: 'Infographic', href: '/infographic' },
        ],
        social: [],
      },
    };
  }
}
