import { Controller, Get, Param, Query } from '@nestjs/common';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { ListNotesQuery, listNotesQuery, NotesService } from './notes.service';

@Controller('notes')
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(@Query(new ZodPipe(listNotesQuery)) query: ListNotesQuery) {
    return this.notes.list(query);
  }

  // Declared before ':slug' so it isn't captured as a slug.
  @Get('archive')
  archive() {
    return this.notes.archive();
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.notes.bySlug(slug);
  }
}
