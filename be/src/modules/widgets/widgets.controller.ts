import {
  Body,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AdminController } from '../../auth/decorators';
import { AppError, notFound } from '../../common/errors/app-error';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { slugifyVi } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';
import { WidgetsService } from './widgets.service';
import { MAX_WIDGET_BYTES } from './widget-html';

const bodySchema = z.object({
  name: z.string().trim().optional(),
  title: z.string().trim().min(1, 'Cần tiêu đề mô tả widget').max(200),
});

@AdminController('posts/:postId/widgets')
export class WidgetsController {
  constructor(
    private readonly widgets: WidgetsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Param('postId') postId: string) {
    await this.assertPost(postId);
    return { data: await this.widgets.list(postId) };
  }

  /** Upload (or replace) one widget HTML file; returns its URL and a ready-to-paste Markdown directive. */
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_WIDGET_BYTES, files: 1 },
    }),
  )
  async upload(
    @Param('postId') postId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodPipe(bodySchema)) body: z.infer<typeof bodySchema>,
  ) {
    await this.assertPost(postId);
    if (!file)
      throw new AppError('FILE_REQUIRED', 'Thiếu file HTML (field "file")');
    const base = (body.name || file.originalname).replace(/\.html?$/i, '');
    const name = `${slugifyVi(base) || 'widget'}.html`;
    const widget = await this.widgets.save(
      postId,
      this.widgets.prepare(name, file.buffer),
      body.title,
    );
    return {
      data: {
        ...widget,
        directive: `::widget{src="${widget.url}" height="420" title="${widget.title.replace(/"/g, "'")}"}`,
      },
    };
  }

  @Delete(':name')
  async remove(@Param('postId') postId: string, @Param('name') name: string) {
    await this.widgets.remove(postId, name);
    return { data: { ok: true } };
  }

  private async assertPost(postId: string) {
    if (!(await this.prisma.post.count({ where: { id: postId } })))
      throw notFound('POST_NOT_FOUND', 'Không tìm thấy bài viết');
  }
}
