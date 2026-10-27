import { INestApplication } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

/** Settings shared by the real server (main.ts) and the e2e tests. */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new AllExceptionsFilter());
  // Swagger UI needs inline scripts, so the strict default CSP is skipped for the docs only.
  const secure = helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
  app.use((req: { path: string }, res: unknown, next: () => void) =>
    req.path.startsWith('/api/docs')
      ? next()
      : (secure as (...a: unknown[]) => void)(req, res, next),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_BASE_URL ?? 'http://localhost:3000',
    credentials: true,
  });
}
