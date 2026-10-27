import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import {
  ADMIN,
  API,
  createApp,
  loginAdmin,
  resetDb,
  seedAdmin,
} from './helpers';

const prisma = new PrismaClient();
let app: INestApplication;
const http = () => request(app.getHttpServer());
const refreshCookie = (cookies: string[]) =>
  cookies.find((c) => c.startsWith('refresh_token='))!.split(';')[0];

beforeAll(async () => {
  await resetDb(prisma);
  await seedAdmin(prisma);
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /auth/login', () => {
  it('returns an access token and sets a hardened refresh cookie', async () => {
    const res = await http().post(`${API}/auth/login`).send(ADMIN).expect(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.user).toEqual(
      expect.objectContaining({ email: ADMIN.email }),
    );
    expect(res.body.data).not.toHaveProperty('refreshToken');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const wrong = await http()
      .post(`${API}/auth/login`)
      .send({ email: ADMIN.email, password: 'nope' })
      .expect(401);
    const unknown = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'ghost@x.co', password: 'nope' })
      .expect(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates the body', async () => {
    const res = await http()
      .post(`${API}/auth/login`)
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me and admin guard', () => {
  it('returns the current user for a valid token', async () => {
    const { token } = await loginAdmin(app);
    const res = await http()
      .get(`${API}/auth/me`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.data.email).toBe(ADMIN.email);
  });

  it.each([
    ['GET', '/auth/me'],
    ['GET', '/admin/posts'],
    ['POST', '/admin/posts'],
    ['GET', '/admin/notes'],
    ['GET', '/admin/series'],
    ['GET', '/admin/categories'],
    ['GET', '/admin/tags'],
    ['PUT', '/admin/pages/about'],
    ['POST', '/admin/revalidate'],
  ])('rejects %s %s without a token', async (method, path) => {
    const res = await http()
      [method.toLowerCase() as 'get'](`${API}${path}`)
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects malformed and wrongly signed tokens', async () => {
    await http()
      .get(`${API}/admin/posts`)
      .set('Authorization', 'Bearer garbage')
      .expect(401);
    const forged =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ4IiwiZW1haWwiOiJ4QHguY28ifQ.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    await http()
      .get(`${API}/admin/posts`)
      .set('Authorization', `Bearer ${forged}`)
      .expect(401);
  });
});

describe('refresh tokens', () => {
  it('rotates on refresh and treats reuse of an old token as theft', async () => {
    const { cookies } = await loginAdmin(app);
    const first = refreshCookie(cookies);

    const rotated = await http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', first)
      .expect(200);
    expect(rotated.body.data.accessToken).toEqual(expect.any(String));
    const second = refreshCookie(
      rotated.headers['set-cookie'] as unknown as string[],
    );
    expect(second).not.toBe(first);

    const reuse = await http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', first)
      .expect(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // The whole family is revoked, so the legitimately rotated token stops working too.
    await http().post(`${API}/auth/refresh`).set('Cookie', second).expect(401);
  });

  it('rejects refresh without a cookie or with an unknown token', async () => {
    expect(
      (await http().post(`${API}/auth/refresh`).expect(401)).body.error.code,
    ).toBe('NO_REFRESH_TOKEN');
    const res = await http()
      .post(`${API}/auth/refresh`)
      .set('Cookie', 'refresh_token=unknown')
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });

  it('stores only a hash of the refresh token', async () => {
    const { cookies } = await loginAdmin(app);
    const raw = refreshCookie(cookies).split('=')[1];
    const rows = await prisma.refreshToken.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tokenHash !== raw)).toBe(true);
  });

  it('logout revokes the token and clears the cookie', async () => {
    const { cookies } = await loginAdmin(app);
    const cookie = refreshCookie(cookies);
    const res = await http()
      .post(`${API}/auth/logout`)
      .set('Cookie', cookie)
      .expect(204);
    expect(res.headers['set-cookie'][0]).toMatch(/refresh_token=;/);
    await http().post(`${API}/auth/refresh`).set('Cookie', cookie).expect(401);
  });
});
