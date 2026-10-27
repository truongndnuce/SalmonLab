import { Body, Get, Param, Put } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { AdminController } from '../../auth/decorators';
import { Events } from '../../common/events';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PrismaService } from '../../prisma/prisma.service';

const pageSchema = z.object({
  title: z.string().trim().min(1),
  bodyMd: z.string(),
});

@AdminController('pages')
export class AdminPagesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  async list() {
    return {
      data: await this.prisma.page.findMany({ orderBy: { slug: 'asc' } }),
    };
  }

  @Put(':slug')
  async upsert(
    @Param('slug') slug: string,
    @Body(new ZodPipe(pageSchema)) dto: z.infer<typeof pageSchema>,
  ) {
    const data = await this.prisma.page.upsert({
      where: { slug },
      update: dto,
      create: { slug, ...dto },
    });
    this.events.emit(Events.PageUpdated, { slug });
    return { data };
  }
}
