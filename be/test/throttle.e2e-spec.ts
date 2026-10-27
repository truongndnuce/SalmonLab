import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { ADMIN, API, createApp, resetDb, seedAdmin } from './helpers';

const prisma = new PrismaClient();
let app: INestApplication;

beforeAll(async () => {
  await resetDb(prisma);
  await seedAdmin(prisma);
  app = await createApp({ throttle: true });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

// Kept in its own file: the limiter is per app instance, so this can't starve the other specs.
it('rate-limits login to 5 attempts per minute, even for correct credentials', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) {
    const res = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: ADMIN.email, password: i < 3 ? 'wrong' : ADMIN.password });
    statuses.push(res.status);
  }
  expect(statuses).toEqual([401, 401, 401, 200, 200, 429, 429]);
});
