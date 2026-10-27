import { Module } from '@nestjs/common';
import { RevalidateController } from './revalidate.controller';
import { RevalidateListener } from './revalidate.listener';
import { RevalidateService } from './revalidate.service';

@Module({
  controllers: [RevalidateController],
  providers: [RevalidateService, RevalidateListener],
  exports: [RevalidateService],
})
export class RevalidateModule {}
