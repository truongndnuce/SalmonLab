import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as Sentry from '@sentry/node';
import type { Response } from 'express';
import { ZodError } from 'zod';

const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: exception.issues
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; '),
        },
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as
        string | { code?: string; message?: string | string[] };
      const code =
        typeof body === 'object' && body.code
          ? body.code
          : (STATUS_CODES[status] ?? 'ERROR');
      const raw = typeof body === 'string' ? body : body.message;
      const message = Array.isArray(raw)
        ? raw.join('; ')
        : (raw ?? exception.message);
      return res.status(status).json({ error: { code, message } });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped: Record<string, [number, string, string]> = {
        P2002: [
          409,
          'CONFLICT',
          'A record with the same unique value already exists',
        ],
        P2003: [400, 'INVALID_REFERENCE', 'A referenced record does not exist'],
        P2025: [404, 'NOT_FOUND', 'Record not found'],
      };
      const hit = mapped[exception.code];
      if (hit)
        return res
          .status(hit[0])
          .json({ error: { code: hit[1], message: hit[2] } });
    }

    this.logger.error(exception);
    Sentry.captureException(exception); // no-op unless SENTRY_DSN is configured
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  }
}
