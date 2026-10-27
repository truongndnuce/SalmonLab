import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BATCH_WINDOW_MS = 150;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Tells the Next app which cache tags are stale. Calls are batched (a publish emits several
 * events at once), retried, and never throw: content is already saved, and the ISR fallback
 * TTL on the web side bounds how long a missed revalidation can stay stale.
 */
@Injectable()
export class RevalidateService {
  private readonly logger = new Logger(RevalidateService.name);
  private pending = new Set<string>();
  private timer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {}

  trigger(tags: string[]) {
    tags.forEach((t) => this.pending.add(t));
    this.timer ??= setTimeout(() => void this.flush(), BATCH_WINDOW_MS);
  }

  /** Sends all pending tags now. Resolves to whether Next acknowledged them. */
  async flush(): Promise<boolean> {
    clearTimeout(this.timer);
    this.timer = undefined;
    const tags = [...this.pending];
    this.pending.clear();
    if (!tags.length) return true;

    const url = this.config.getOrThrow<string>('WEB_REVALIDATE_URL');
    const secret = this.config.getOrThrow<string>('REVALIDATE_SECRET');
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-revalidate-secret': secret,
          },
          body: JSON.stringify({ tags }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.ok) {
          this.logger.log(`Revalidated: ${tags.join(', ')}`);
          return true;
        }
        this.logger.warn(
          `Revalidate attempt ${attempt} failed: HTTP ${res.status}`,
        );
        if (res.status === 401) break; // wrong secret won't fix itself
      } catch (err) {
        this.logger.warn(
          `Revalidate attempt ${attempt} failed: ${(err as Error).message}`,
        );
      }
      if (attempt < MAX_ATTEMPTS)
        await new Promise((r) => setTimeout(r, 500 * attempt));
    }
    this.logger.error(`Giving up revalidating: ${tags.join(', ')}`);
    return false;
  }
}
