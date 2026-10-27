import {
  Body,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AdminController } from '../../auth/decorators';
import { AppError } from '../../common/errors/app-error';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { MAX_IMAGE_BYTES } from './image';
import { MediaService } from './media.service';

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
});
const patchSchema = z.object({
  alt: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .transform((v) => v || null),
});

@AdminController('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(@Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.media.list(q.page, q.pageSize);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { alt?: string; postId?: string },
  ) {
    if (!file)
      throw new AppError('FILE_REQUIRED', 'Thiếu file ảnh (field "file")');
    return {
      data: await this.media.upload(file.buffer, {
        alt: body.alt?.slice(0, 300),
        postId: body.postId,
      }),
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodPipe(patchSchema)) dto: z.infer<typeof patchSchema>,
  ) {
    return { data: await this.media.setAlt(id, dto.alt) };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.media.remove(id);
    return { data: { ok: true } };
  }
}
