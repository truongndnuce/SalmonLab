import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import { AdminController } from '../../auth/decorators';
import { Events } from '../../common/events';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { slugifyVi } from '../../common/utils/slug';
import { PrismaService } from '../../prisma/prisma.service';

const createSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .optional(),
});
const updateSchema = createSchema.partial();
type Create = z.infer<typeof createSchema>;
type Update = z.infer<typeof updateSchema>;

@AdminController('categories')
export class AdminCategoriesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  async list() {
    return {
      data: await this.prisma.category.findMany({ orderBy: { name: 'asc' } }),
    };
  }

  // Duplicate slugs surface as 409 CONFLICT via the Prisma error mapping in AllExceptionsFilter.
  @Post()
  async create(@Body(new ZodPipe(createSchema)) dto: Create) {
    const data = await this.prisma.category.create({
      data: { name: dto.name, slug: dto.slug ?? slugifyVi(dto.name) },
    });
    this.events.emit(Events.TaxonomyUpdated, {});
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateSchema)) dto: Update,
  ) {
    const data = await this.prisma.category.update({
      where: { id },
      data: dto,
    });
    this.events.emit(Events.TaxonomyUpdated, {});
    return { data };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.prisma.category.delete({ where: { id } });
    this.events.emit(Events.TaxonomyUpdated, {});
  }
}

@AdminController('tags')
export class AdminTagsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  async list() {
    return {
      data: await this.prisma.tag.findMany({ orderBy: { name: 'asc' } }),
    };
  }

  @Post()
  async create(@Body(new ZodPipe(createSchema)) dto: Create) {
    const data = await this.prisma.tag.create({
      data: { name: dto.name, slug: dto.slug ?? slugifyVi(dto.name) },
    });
    this.events.emit(Events.TaxonomyUpdated, {});
    return { data };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateSchema)) dto: Update,
  ) {
    const data = await this.prisma.tag.update({ where: { id }, data: dto });
    this.events.emit(Events.TaxonomyUpdated, {});
    return { data };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.prisma.tag.delete({ where: { id } });
    this.events.emit(Events.TaxonomyUpdated, {});
  }
}
