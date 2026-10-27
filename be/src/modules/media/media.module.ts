import { Global, Module } from '@nestjs/common';
import { WidgetsController } from '../widgets/widgets.controller';
import { WidgetsService } from '../widgets/widgets.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [MediaController, WidgetsController],
  providers: [StorageService, MediaService, WidgetsService],
  exports: [StorageService, MediaService, WidgetsService],
})
export class MediaModule {}
