import { Body, Get, Put } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AdminController } from '../../auth/decorators';
import { Events } from '../../common/events';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import {
  SettingsService,
  SiteSettings,
  siteSettingsSchema,
} from './settings.service';

@AdminController('settings')
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly events: EventEmitter2,
  ) {}

  @Get()
  async get() {
    return {
      data: await this.settings.getSite(),
      meta: { defaults: this.settings.defaults() },
    };
  }

  @Put()
  async put(@Body(new ZodPipe(siteSettingsSchema)) dto: SiteSettings) {
    const data = await this.settings.saveSite(dto);
    this.events.emit(Events.SiteUpdated, {});
    return { data };
  }
}
