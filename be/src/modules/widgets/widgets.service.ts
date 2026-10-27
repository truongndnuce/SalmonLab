import { Injectable } from '@nestjs/common';
import { AppError, notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../media/storage.service';
import { injectHost, validateWidgetHtml, WIDGET_NAME_RE } from './widget-html';

export interface PreparedWidget {
  name: string;
  html: string;
}

@Injectable()
export class WidgetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Validates and wraps a widget in memory; nothing is stored, so callers can check everything up front. */
  prepare(name: string, raw: Buffer): PreparedWidget {
    if (!WIDGET_NAME_RE.test(name))
      throw new AppError(
        'WIDGET_NAME_INVALID',
        `Tên widget "${name}" không hợp lệ (chữ thường, số, dấu gạch ngang, đuôi .html)`,
      );
    const text = raw.toString('utf8');
    if (text.includes('\u0000'))
      throw new AppError(
        'WIDGET_INVALID',
        `Widget "${name}": không phải văn bản`,
      );
    validateWidgetHtml(text, name);
    return { name, html: injectHost(text) };
  }

  async save(postId: string, w: PreparedWidget, title: string) {
    const key = `widgets/${postId}/${w.name}`;
    const body = Buffer.from(w.html, 'utf8');
    // Same key on re-upload, so keep the cache short (unlike content-addressed media).
    await this.storage.put(
      this.storage.widgets,
      key,
      body,
      'text/html; charset=utf-8',
      'public, max-age=300',
    );
    return this.prisma.widget.upsert({
      where: { postId_name: { postId, name: w.name } },
      create: {
        postId,
        name: w.name,
        r2Key: key,
        url: this.storage.publicUrl(this.storage.widgets, key),
        title,
        size: body.length,
      },
      update: {
        title,
        size: body.length,
        url: this.storage.publicUrl(this.storage.widgets, key),
      },
    });
  }

  list(postId: string) {
    return this.prisma.widget.findMany({
      where: { postId },
      orderBy: { name: 'asc' },
    });
  }

  async remove(postId: string, name: string) {
    const w = await this.prisma.widget.findUnique({
      where: { postId_name: { postId, name } },
    });
    if (!w) throw notFound('WIDGET_NOT_FOUND', 'Không tìm thấy widget');
    await this.storage.remove(this.storage.widgets, w.r2Key);
    await this.prisma.widget.delete({ where: { id: w.id } });
  }

  /** Called before a post is deleted: the DB rows cascade, but the stored files would be orphaned. */
  async removeAllForPost(postId: string) {
    const rows = await this.prisma.widget.findMany({ where: { postId } });
    if (rows.length)
      await this.storage.removeMany(
        this.storage.widgets,
        rows.map((r) => r.r2Key),
      );
  }
}
