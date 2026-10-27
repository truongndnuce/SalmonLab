import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env';

export const siteSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Cần tên site').max(80),
  tagline: z.string().trim().max(300),
  coverUrl: z
    .string()
    .trim()
    .max(1000)
    .url('Ảnh bìa phải là URL hợp lệ')
    .nullable()
    .or(z.literal(''))
    .transform((v) => v || null),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const KEY = 'site';

/** Site-wide settings: admin edits (DB) win over the SITE_* environment defaults. */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  defaults(): SiteSettings {
    return {
      name: this.config.get('SITE_NAME', { infer: true }),
      tagline: this.config.get('SITE_TAGLINE', { infer: true }),
      coverUrl: this.config.get('SITE_COVER_URL', { infer: true }) ?? null,
    };
  }

  async getSite(): Promise<SiteSettings> {
    const row = await this.prisma.setting.findUnique({ where: { key: KEY } });
    const saved = siteSettingsSchema.partial().safeParse(row?.value);
    return { ...this.defaults(), ...(saved.success ? saved.data : {}) };
  }

  async saveSite(dto: SiteSettings): Promise<SiteSettings> {
    await this.prisma.setting.upsert({
      where: { key: KEY },
      create: { key: KEY, value: dto },
      update: { value: dto },
    });
    return this.getSite();
  }
}
