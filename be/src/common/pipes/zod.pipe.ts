import { PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/** Validates and coerces a query/body with a zod schema; ZodError is mapped by AllExceptionsFilter. */
export class ZodPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
