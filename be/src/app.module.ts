import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { RevalidateModule } from './modules/revalidate/revalidate.module';
import { FeedModule } from './modules/feed/feed.module';
import { HomeModule } from './modules/home/home.module';
import { MediaModule } from './modules/media/media.module';
import { NotesModule } from './modules/notes/notes.module';
import { PagesModule } from './modules/pages/pages.module';
import { PostsModule } from './modules/posts/posts.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SearchModule } from './modules/search/search.module';
import { SeriesModule } from './modules/series/series.module';
import { SiteModule } from './modules/site/site.module';
import { TaxonomyModule } from './modules/taxonomy/taxonomy.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
      },
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    AdminModule,
    RevalidateModule,
    HealthModule,
    SiteModule,
    HomeModule,
    PostsModule,
    NotesModule,
    SeriesModule,
    PagesModule,
    TaxonomyModule,
    FeedModule,
    MediaModule,
    SearchModule,
    SettingsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
