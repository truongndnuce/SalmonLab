import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const user = {
  id: 'u1',
  email: 'a@b.co',
  displayName: 'A',
  avatarUrl: null,
  passwordHash: 'x',
};

function setup(row: unknown) {
  const prisma = {
    refreshToken: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({}),
    },
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue('access'),
  } as unknown as JwtService;
  return { prisma, service: new AuthService(prisma as never, jwt) };
}

describe('AuthService.refresh', () => {
  it('rejects a missing token', async () => {
    await expect(setup(null).service.refresh(undefined)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotates a valid token: revokes old, stores hash of the new one', async () => {
    const { prisma, service } = setup({
      id: 'r1',
      userId: 'u1',
      user,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1e6),
    });
    const res = await service.refresh('old');
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256('old') } }),
    );
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'r1' } }),
    );
    expect(prisma.refreshToken.create.mock.calls[0][0].data.tokenHash).toBe(
      sha256(res.refreshToken),
    );
  });

  it('revokes every token of the user when a revoked token is reused', async () => {
    const { prisma, service } = setup({
      id: 'r1',
      userId: 'u1',
      user,
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1e6),
    });
    await expect(service.refresh('old')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1', revokedAt: null } }),
    );
  });

  it('rejects an expired token', async () => {
    const { service } = setup({
      id: 'r1',
      userId: 'u1',
      user,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
    });
    await expect(service.refresh('old')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
