import { Module } from '@nestjs/common';
import { AdminImportController } from './admin-import.controller';
import { AdminImportService } from './admin-import.service';
import { AdminNotesController } from './admin-notes.controller';
import { AdminNotesService } from './admin-notes.service';
import { AdminPagesController } from './admin-pages.controller';
import { AdminPostsController } from './admin-posts.controller';
import { AdminPostsService } from './admin-posts.service';
import { AdminSeriesController } from './admin-series.controller';
import {
  AdminCategoriesController,
  AdminTagsController,
} from './admin-taxonomy.controller';

@Module({
  controllers: [
    AdminPostsController,
    AdminNotesController,
    AdminSeriesController,
    AdminCategoriesController,
    AdminTagsController,
    AdminPagesController,
    AdminImportController,
  ],
  providers: [AdminPostsService, AdminNotesService, AdminImportService],
})
export class AdminModule {}
