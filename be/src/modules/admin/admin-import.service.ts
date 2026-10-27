import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { slugifyVi, uniqueSlug } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';
import {
  findWidgets,
  parseMarkdown,
  readZip,
  replaceWidgetSrc,
  rewriteImages,
} from '../import/parse';
import { MediaService } from '../media/media.service';
import { posix } from 'node:path';
import { PreparedWidget, WidgetsService } from '../widgets/widgets.service';
import { AdminPostsService } from './admin-posts.service';

export type OnConflict = 'rename' | 'overwrite' | 'reject';

@Injectable()
export class AdminImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: AdminPostsService,
    private readonly media: MediaService,
    private readonly widgets: WidgetsService,
  ) {}

  /**
   * Imports one .md (front matter + body) or .zip (one .md + its images) as a DRAFT. Always a draft so the author
   * reviews it in the editor before it goes public; the original `date` is kept and survives publishing.
   */
  async importPost(
    file: { buffer: Buffer; originalname: string },
    opts: { onConflict: OnConflict },
    authorId: string,
  ) {
    const warnings: string[] = [];
    const name = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const isZip =
      /\.zip$/i.test(name) || file.buffer.subarray(0, 2).toString() === 'PK';

    let mdText: string;
    let uploaded = 0;
    let rewrite: ((md: string) => Promise<string>) | null = null;
    // Widgets are validated before anything is created, so a bad file never leaves a half-imported post behind.
    const widgetUploads: {
      src: string;
      widget: PreparedWidget;
      title: string;
    }[] = [];
    if (isZip) {
      const zip = readZip(file.buffer);
      mdText = zip.md;
      for (const w of findWidgets(mdText)) {
        if (/^(https?:)?\/\//i.test(w.src)) continue;
        const path = posix.normalize(
          posix.join(posix.dirname(zip.mdName), w.src),
        );
        const html = zip.htmls.get(path);
        if (!html) {
          warnings.push(`Không tìm thấy widget trong .zip: ${w.src}`);
          continue;
        }
        if (widgetUploads.some((u) => u.src === w.src)) continue;
        const prepared = this.widgets.prepare(
          posix.basename(path).toLowerCase(),
          html,
        );
        widgetUploads.push({
          src: w.src,
          widget: prepared,
          title: w.title ?? prepared.name,
        });
      }
      rewrite = async (md) => {
        const r = await rewriteImages(
          md,
          zip.mdName,
          zip.images,
          async (_p, data) => {
            uploaded++;
            return (await this.media.upload(data, {})).url;
          },
        );
        for (const m of r.missing)
          warnings.push(`Không tìm thấy ảnh trong .zip: ${m}`);
        return r.md;
      };
    } else if (/\.(md|markdown|txt)$/i.test(name)) {
      if (file.buffer.includes(0))
        throw new AppError('INVALID_FILE', 'File không phải văn bản');
      mdText = file.buffer.toString('utf8');
    } else {
      throw new AppError('UNSUPPORTED_FILE', 'Chỉ nhận file .md hoặc .zip');
    }

    const doc = parseMarkdown(mdText, isZip ? '' : name);
    if (!doc.title)
      throw new AppError(
        'TITLE_REQUIRED',
        'Không xác định được tiêu đề (thêm `title:` hoặc dòng `# Tiêu đề`)',
      );
    const slug = doc.slug
      ? slugifyVi(doc.slug)
      : slugifyVi(doc.title) || 'bai-viet';

    const existing = await this.prisma.post.findUnique({ where: { slug } });
    if (existing && opts.onConflict === 'reject') {
      throw new AppError('SLUG_TAKEN', `Slug "${slug}" đã tồn tại`, 409);
    }
    if (
      existing &&
      existing.kind !== doc.kind &&
      opts.onConflict === 'overwrite'
    ) {
      throw new AppError(
        'KIND_MISMATCH',
        'Không thể ghi đè bài khác loại (bài viết/infographic)',
        409,
      );
    }

    let categoryId: string | null = null;
    if (doc.category) {
      const cat = await this.prisma.category.findFirst({
        where: {
          OR: [
            { slug: slugifyVi(doc.category) },
            { name: { equals: doc.category, mode: 'insensitive' } },
          ],
        },
      });
      if (cat) categoryId = cat.id;
      else
        warnings.push(
          `Không có danh mục "${doc.category}"; bài được để không có danh mục`,
        );
    }

    const bodyMd = rewrite ? await rewrite(doc.bodyMd) : doc.bodyMd;
    const fields = {
      title: doc.title,
      excerpt: doc.excerpt,
      bodyMd,
      kind: doc.kind,
      tags: doc.tags,
      ...(categoryId && { categoryId }),
    };

    let id: string;
    let outcome: 'created' | 'renamed' | 'overwritten' = 'created';
    if (existing && opts.onConflict === 'overwrite') {
      id = existing.id;
      outcome = 'overwritten';
      await this.posts.update(id, fields);
    } else {
      const finalSlug = existing
        ? await uniqueSlug(
            slug,
            async (s) =>
              (await this.prisma.post.count({ where: { slug: s } })) > 0,
          )
        : slug;
      if (existing) outcome = 'renamed';
      id = (await this.posts.create({ ...fields, slug: finalSlug }, authorId))
        .data.id;
    }
    if (widgetUploads.length) {
      const map = new Map<string, string>();
      for (const u of widgetUploads)
        map.set(u.src, (await this.widgets.save(id, u.widget, u.title)).url);
      const cur = await this.prisma.post.findUniqueOrThrow({ where: { id } });
      await this.posts.update(id, {
        bodyMd: replaceWidgetSrc(cur.bodyMd, map),
      });
    }
    // A past original date is kept; AdminPostsService.publish reuses it instead of stamping "now".
    if (doc.date && doc.date <= new Date() && outcome !== 'overwritten') {
      await this.prisma.post.update({
        where: { id },
        data: { publishedAt: doc.date },
      });
    }
    return {
      data: (await this.posts.get(id)).data,
      meta: {
        outcome,
        uploadedImages: uploaded,
        uploadedWidgets: widgetUploads.length,
        warnings,
      },
    };
  }
}
