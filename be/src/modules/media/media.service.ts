import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { notFound } from '../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { processImage } from './image';
import { StorageService } from './storage.service';

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(file: Buffer, opts: { alt?: string; postId?: string }) {
    const img = await processImage(file);
    const d = new Date();
    const key = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${img.ext}`;
    const bucket = this.storage.media;
    await this.storage.put(bucket, key, img.buffer, img.mime);
    try {
      return await this.prisma.media.create({
        data: {
          bucket,
          key,
          url: this.storage.publicUrl(bucket, key),
          mimeType: img.mime,
          size: img.buffer.length,
          width: img.width,
          height: img.height,
          alt: opts.alt || null,
          postId: opts.postId || null,
        },
      });
    } catch (e) {
      await this.storage.remove(bucket, key).catch(() => undefined);
      throw e;
    }
  }

  async list(page: number, pageSize: number) {
    const [data, total] = await Promise.all([
      this.prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.media.count(),
    ]);
    return { data, meta: { page, pageSize, total } };
  }

  async setAlt(id: string, alt: string | null) {
    const exists = await this.prisma.media.findUnique({ where: { id } });
    if (!exists) throw notFound('MEDIA_NOT_FOUND', 'Không tìm thấy ảnh');
    return this.prisma.media.update({ where: { id }, data: { alt } });
  }

  async remove(id: string) {
    const m = await this.prisma.media.findUnique({ where: { id } });
    if (!m) throw notFound('MEDIA_NOT_FOUND', 'Không tìm thấy ảnh');
    await this.storage.remove(m.bucket, m.key);
    await this.prisma.media.delete({ where: { id } });
  }
}
