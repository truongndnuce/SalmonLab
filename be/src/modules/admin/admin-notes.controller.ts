import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AdminController, CurrentUser } from '../../auth/decorators';
import { AuthUser } from '../../auth/jwt.strategy';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import {
  AdminNotesService,
  CreateNote,
  createNoteSchema,
  ListAdminNotesQuery,
  listAdminNotesQuery,
  scheduleNoteSchema,
  UpdateNote,
  updateNoteSchema,
} from './admin-notes.service';

@AdminController('notes')
export class AdminNotesController {
  constructor(private readonly notes: AdminNotesService) {}

  @Get()
  list(@Query(new ZodPipe(listAdminNotesQuery)) query: ListAdminNotesQuery) {
    return this.notes.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.notes.get(id);
  }

  @Post()
  create(
    @Body(new ZodPipe(createNoteSchema)) dto: CreateNote,
    @CurrentUser() user: AuthUser,
  ) {
    return this.notes.create(dto, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodPipe(updateNoteSchema)) dto: UpdateNote,
  ) {
    return this.notes.update(id, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  publish(@Param('id') id: string) {
    return this.notes.publish(id);
  }

  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@Param('id') id: string) {
    return this.notes.unpublish(id);
  }

  @Post(':id/schedule')
  @HttpCode(200)
  schedule(
    @Param('id') id: string,
    @Body(new ZodPipe(scheduleNoteSchema)) body: { publishedAt: Date },
  ) {
    return this.notes.schedule(id, body.publishedAt);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.notes.remove(id);
  }
}
