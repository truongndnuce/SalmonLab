import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { Events } from '../../common/events';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Scheduled posts become public simply by their `publishedAt` passing, but cached pages don't know that. Every
 * minute, announce items whose time arrived since the last tick so the web cache refreshes right on schedule.
 * The window starts a few minutes before boot so a restart doesn't skip an item due while the API was down; items
 * published manually get one extra (harmless, batched) revalidate.
 */
@Injectable()
export class ScheduledPublishService {
  private last = new Date(Date.now() - 5 * 60_000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  @Interval(60_000)
  async onInterval() {
    if (process.env.NODE_ENV === 'test') return;
    await this.tick().catch(() => undefined);
  }

  async tick(now = new Date()) {
    const window = { gt: this.last, lte: now };
    this.last = now;
    const [posts, notes] = await Promise.all([
      this.prisma.post.findMany({
        where: { status: 'PUBLISHED', publishedAt: window },
        select: { slug: true, kind: true },
      }),
      this.prisma.note.findMany({
        where: { status: 'PUBLISHED', publishedAt: window },
        select: { slug: true },
      }),
    ]);
    for (const p of posts) this.events.emit(Events.PostPublished, p);
    for (const n of notes) this.events.emit(Events.NotePublished, n);
    return { posts: posts.length, notes: notes.length };
  }
}
