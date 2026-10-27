import { Global, Module } from '@nestjs/common';
import { AdminSettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  controllers: [AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
