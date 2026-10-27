import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/** After this many wrong passwords the account is locked for LOCK_MS (on top of the per-IP rate limit). */
export const MAX_FAILED_LOGINS = 10;
export const LOCK_MS = 15 * 60 * 1000;

export const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class AuthService {
  // Verified against when the email is unknown so response time doesn't reveal which emails exist.
  private dummyHash?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    this.dummyHash ??= argon2.hash('dummy-password');
    const ok = await argon2
      .verify(user?.passwordHash ?? (await this.dummyHash), password)
      .catch(() => false);

    // A locked account is rejected even with the right password, so guessing can't continue during the lock.
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      throw new HttpException(
        {
          code: 'ACCOUNT_LOCKED',
          message: `Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau ${mins} phút`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!user || !ok) {
      if (user) {
        const { failedLogins } = await this.prisma.user.update({
          where: { id: user.id },
          data: { failedLogins: { increment: 1 } },
        });
        if (failedLogins >= MAX_FAILED_LOGINS)
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: 0,
              lockedUntil: new Date(Date.now() + LOCK_MS),
            },
          });
      }
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Email hoặc mật khẩu không đúng',
      });
    }
    if (user.failedLogins || user.lockedUntil)
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null },
      });
    return this.issue(user);
  }

  /** Rotates the refresh token. Presenting an already-revoked token means theft: revoke the whole family. */
  async refresh(raw: string | undefined) {
    if (!raw)
      throw new UnauthorizedException({
        code: 'NO_REFRESH_TOKEN',
        message: 'Missing refresh token',
      });
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(raw) },
      include: { user: true },
    });
    if (!row)
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid refresh token',
      });
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: 'REFRESH_TOKEN_REUSED',
        message: 'Refresh token reused',
      });
    }
    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token expired',
      });
    }
    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issue(row.user);
  }

  async logout(raw: string | undefined) {
    if (!raw) return;
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: sha256(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user)
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'User not found',
      });
    return this.publicUser(user);
  }

  private publicUser(u: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  }) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
    };
  }

  private async issue(user: {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
  }) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });
    return { accessToken, refreshToken, user: this.publicUser(user) };
  }
}
