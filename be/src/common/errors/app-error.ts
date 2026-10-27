import { HttpException, HttpStatus } from '@nestjs/common';

/** HttpException carrying a stable machine-readable code for the `{ error }` envelope. */
export class AppError extends HttpException {
  constructor(
    readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ code, message }, status);
  }
}

export const notFound = (code: string, message: string) =>
  new AppError(code, message, HttpStatus.NOT_FOUND);
