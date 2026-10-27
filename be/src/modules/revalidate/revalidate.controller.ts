import { Body, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { AdminController } from '../../auth/decorators';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ALL_TAGS } from './revalidate.tags';
import { RevalidateService } from './revalidate.service';

const bodySchema = z.object({
  tags: z.array(z.string().min(1)).min(1).optional(),
});

@AdminController('revalidate')
export class RevalidateController {
  constructor(private readonly revalidate: RevalidateService) {}

  /** Manual refresh; with no body it refreshes every tag (use after a deploy). */
  @Post()
  @HttpCode(200)
  async run(@Body(new ZodPipe(bodySchema)) body: z.infer<typeof bodySchema>) {
    const tags = body.tags ?? ALL_TAGS;
    this.revalidate.trigger(tags);
    const ok = await this.revalidate.flush();
    return { data: { tags, ok } };
  }
}
