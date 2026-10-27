import {
  applyDecorators,
  Controller,
  createParamDecorator,
  ExecutionContext,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthUser } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

/** Controller mounted under /admin/<path> and protected by JWT; use this so a route can't be left open. */
export const AdminController = (path: string) =>
  applyDecorators(
    Controller(`admin/${path}`),
    UseGuards(JwtAuthGuard),
    ApiBearerAuth(),
  );

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
