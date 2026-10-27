import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ZodPipe } from '../common/pipes/zod.pipe';
import { AuthService, REFRESH_TTL_MS } from './auth.service';
import { CurrentUser } from './decorators';
import { AuthUser } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

const COOKIE = 'refresh_token';
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  // Resolved per request so ops/tests can raise it via LOGIN_RATE_LIMIT; the default protects against brute force.
  @Throttle({
    default: {
      limit: () => Number(process.env.LOGIN_RATE_LIMIT) || 5,
      ttl: 60_000,
    },
  })
  async login(
    @Body(new ZodPipe(loginSchema)) body: z.infer<typeof loginSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.auth.login(
      body.email,
      body.password,
    );
    this.setCookie(res, refreshToken);
    return { data: result };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...result } = await this.auth.refresh(
      req.cookies?.[COOKIE],
    );
    this.setCookie(res, refreshToken);
    return { data: result };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, this.cookieOptions());
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    return { data: await this.auth.me(user.id) };
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/auth',
    };
  }

  private setCookie(res: Response, token: string) {
    res.cookie(COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: REFRESH_TTL_MS,
    });
  }
}
