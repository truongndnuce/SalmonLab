import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RevalidateService } from '../src/modules/revalidate/revalidate.service';

export const ADMIN = {
  email: 'e2e@salmonlab.local',
  password: 'e2e-password-123',
};
export const API = '/api/v1';

export const revalidateStub = {
  trigger: jest.fn(),
  flush: jest.fn().mockResolvedValue(true),
};

/** The login rate limiter is off by default so specs can log in freely; throttle.e2e-spec turns it on. */
export async function createApp({
  throttle = false,
} = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(RevalidateService)
    .useValue(revalidateStub);
  if (!throttle)
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export async function resetDb(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "RefreshToken","PostTag","NoteTag","Widget","Media","Post","Note","Series","Tag","Category","Page","Setting","SlugRedirect","User" RESTART IDENTITY CASCADE',
  );
}

export async function seedAdmin(prisma: PrismaClient) {
  return prisma.user.create({
    data: {
      email: ADMIN.email,
      displayName: 'E2E',
      passwordHash: await argon2.hash(ADMIN.password),
    },
  });
}

export async function loginAdmin(app: INestApplication) {
  const res = await request(app.getHttpServer())
    .post(`${API}/auth/login`)
    .send(ADMIN)
    .expect(200);
  return {
    token: res.body.data.accessToken as string,
    cookies: res.headers['set-cookie'] as unknown as string[],
  };
}
