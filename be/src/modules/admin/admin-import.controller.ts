import {
  Body,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AdminController, CurrentUser } from '../../auth/decorators';
import { AppError } from '../../common/errors/app-error';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { MAX_UPLOAD_BYTES } from '../import/parse';
import { AdminImportService } from './admin-import.service';

const bodySchema = z.object({
  onConflict: z.enum(['rename', 'overwrite', 'reject']).default('rename'),
});

@AdminController('import')
export class AdminImportController {
  constructor(private readonly service: AdminImportService) {}

  // Parsing archives and re-encoding images is expensive: cap the rate even for the (single) admin.
  @Post()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    }),
  )
  async import(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodPipe(bodySchema)) body: z.infer<typeof bodySchema>,
    @CurrentUser() user: { id: string },
  ) {
    if (!file) throw new AppError('FILE_REQUIRED', 'Thiếu file (field "file")');
    return this.service.importPost(file, body, user.id);
  }
}
