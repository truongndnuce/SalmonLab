import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import * as request from 'supertest';
import { LOCK_MS, MAX_FAILED_LOGINS } from '../src/auth/auth.service';
import { ScheduledPublishService } from '../src/modules/scheduler/scheduled-publish.service';
import {
  API,
  createApp,
  loginAdmin,
  resetDb,
  revalidateStub,
  seedAdmin,
} from './helpers';

const prisma = new PrismaClient();
let app: INestApplication;
let auth: { Authorization: string };
const http = () => request(app.getHttpServer());
const triggered = () =>
  revalidateStub.trigger.mock.calls.flatMap(([t]) => t as string[]);

beforeAll(async () => {
  await resetDb(prisma);
  await seedAdmin(prisma);
  app = await createApp();
  auth = { Authorization: `Bearer ${(await loginAdmin(app)).token}` };
});
afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('account lockout', () => {
  const email = 'lock@salmonlab.local';
  const login = (password: string) =>
    http().post(`${API}/auth/login`).send({ email, password });

  it('locks after repeated failures, even for the right password, then recovers', async () => {
    await prisma.user.create({
      data: {
        email,
        displayName: 'L',
        passwordHash: await argon2.hash('right-password-1'),
      },
    });
    for (let i = 0; i < MAX_FAILED_LOGINS; i++)
      await login('wrong').expect(401);
    const locked = await login('right-password-1').expect(429);
    expect(locked.body.error.code).toBe('ACCOUNT_LOCKED');

    await prisma.user.update({
      where: { email },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    await login('right-password-1').expect(200);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email } })).failedLogins,
    ).toBe(0);
    expect(LOCK_MS).toBe(15 * 60_000);
  });

  it('counts only consecutive failures', async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++)
      await login('wrong').expect(401);
    await login('right-password-1').expect(200);
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++)
      await login('wrong').expect(401);
    await login('right-password-1').expect(200);
  });
});

describe('site settings', () => {
  it('requires auth, validates, overrides env defaults and refreshes the web cache', async () => {
    await http().get(`${API}/admin/settings`).expect(401);
    const before = await http().get(`${API}/site`).expect(200);
    expect(before.body.data.name).toBe('Salmon Lab');

    await http()
      .put(`${API}/admin/settings`)
      .set(auth)
      .send({ name: '', tagline: '', coverUrl: null })
      .expect(400);
    await http()
      .put(`${API}/admin/settings`)
      .set(auth)
      .send({ name: 'X', tagline: '', coverUrl: 'not a url' })
      .expect(400);

    revalidateStub.trigger.mockClear();
    await http()
      .put(`${API}/admin/settings`)
      .set(auth)
      .send({ name: 'Lab Mới', tagline: 'Khẩu hiệu', coverUrl: '' })
      .expect(200);
    const after = await http().get(`${API}/site`).expect(200);
    expect(after.body.data).toMatchObject({
      name: 'Lab Mới',
      tagline: 'Khẩu hiệu',
      coverUrl: null,
    });
    expect(triggered()).toEqual(
      expect.arrayContaining(['site', 'home', 'feed']),
    );
    const rss = await http().get(`${API}/feed/rss`).expect(200);
    expect(rss.body.data.title).toBe('Lab Mới');
  });
});

describe('scheduled publish tick', () => {
  it('announces items whose publish time has arrived, once', async () => {
    const author = await prisma.user.findFirstOrThrow();
    await prisma.post.create({
      data: {
        slug: 'hen-gio',
        title: 'Hẹn giờ',
        bodyMd: 'x',
        authorId: author.id,
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() - 60_000),
      },
    });
    await prisma.post.create({
      data: {
        slug: 'tuong-lai',
        title: 'Tương lai',
        bodyMd: 'x',
        authorId: author.id,
        status: 'PUBLISHED',
        publishedAt: new Date(Date.now() + 3_600_000),
      },
    });
    revalidateStub.trigger.mockClear();
    const svc = app.get(ScheduledPublishService);
    expect(await svc.tick()).toEqual({ posts: 1, notes: 0 });
    expect(triggered()).toContain('post:hen-gio');
    expect(triggered()).not.toContain('post:tuong-lai');
    expect(await svc.tick()).toEqual({ posts: 0, notes: 0 });
    // when the future item's time comes
    expect((await svc.tick(new Date(Date.now() + 7_200_000))).posts).toBe(1);
  });
});

describe('security headers', () => {
  it('sends helmet headers on API responses', async () => {
    const res = await http().get(`${API}/site`).expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'self'",
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
