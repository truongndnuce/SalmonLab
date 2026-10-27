import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledPublishService } from './scheduled-publish.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [ScheduledPublishService],
  exports: [ScheduledPublishService],
})
export class SchedulerModule {}
