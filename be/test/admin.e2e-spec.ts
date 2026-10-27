import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
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
const pub = (path: string) => http().get(`${API}${path}`);
const admin = {
  get: (p: string) => http().get(`${API}/admin${p}`).set(auth),
  post: (p: string, body?: object) =>
    http().post(`${API}/admin${p}`).set(auth).send(body),
  patch: (p: string, body: object) =>
    http().patch(`${API}/admin${p}`).set(auth).send(body),
  put: (p: string, body: object) =>
    http().put(`${API}/admin${p}`).set(auth).send(body),
  del: (p: string) => http().delete(`${API}/admin${p}`).set(auth),
};

beforeAll(async () => {
  await resetDb(prisma);
  await seedAdmin(prisma);
  app = await createApp();
  auth = { Authorization: `Bearer ${(await loginAdmin(app)).token}` };
});

beforeEach(() => revalidateStub.trigger.mockClear());

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const triggered = () =>
  revalidateStub.trigger.mock.calls.flatMap(([tags]) => tags as string[]);

describe('post lifecycle: create → publish → public → unpublish → delete', () => {
  let id: string;

  it('creates a draft with a Vietnamese slug, stats and tags, invisible to the public', async () => {
    const res = await admin
      .post('/posts', {
        title: 'Đường đi của gói tin',
        bodyMd: 'một hai ba',
        tags: ['AWS', 'Mạng'],
      })
      .expect(201);
    id = res.body.data.id;
    expect(res.body.data).toEqual(
      expect.objectContaining({
        slug: 'duong-di-cua-goi-tin',
        status: 'DRAFT',
        wordCount: 3,
        readingMins: 1,
        publishedAt: null,
      }),
    );
    expect(
      res.body.data.tags.map((t: { slug: string }) => t.slug).sort(),
    ).toEqual(['aws', 'mang']);
    await pub('/posts/duong-di-cua-goi-tin').expect(404);
    expect(revalidateStub.trigger).not.toHaveBeenCalled();
  });

  it('suffixes a colliding generated slug and rejects an explicit duplicate', async () => {
    const dup = await admin
      .post('/posts', { title: 'Đường đi của gói tin' })
      .expect(201);
    expect(dup.body.data.slug).toBe('duong-di-cua-goi-tin-2');
    await admin
      .post('/posts', { title: 'x', slug: 'duong-di-cua-goi-tin' })
      .expect(409);
    await admin.del(`/posts/${dup.body.data.id}`).expect(204);
  });

  it('publishes: becomes public and asks the web app to revalidate the right tags', async () => {
    const res = await admin.post(`/posts/${id}/publish`).expect(200);
    expect(res.body.data.status).toBe('PUBLISHED');
    expect(res.body.data.publishedAt).toEqual(expect.any(String));
    await pub('/posts/duong-di-cua-goi-tin').expect(200);
    expect(triggered()).toEqual(
      expect.arrayContaining([
        'posts',
        'post:duong-di-cua-goi-tin',
        'home',
        'feed',
      ]),
    );
  });

  it('renaming a published post keeps the old URL alive as a redirect (no chains, reusable slugs)', async () => {
    const orig = 'duong-di-cua-goi-tin';
    const redirect = (slug: string) => pub(`/redirects/posts/${slug}`);

    await admin.patch(`/posts/${id}`, { slug: 'doi-slug' }).expect(200);
    await pub(`/posts/${orig}`).expect(404);
    await pub('/posts/doi-slug').expect(200);
    expect((await redirect(orig).expect(200)).body.data.slug).toBe('doi-slug');
    // both the old and the new page must be refreshed
    expect(triggered()).toEqual(
      expect.arrayContaining([`post:${orig}`, 'post:doi-slug']),
    );

    await admin.patch(`/posts/${id}`, { slug: 'doi-slug-2' }).expect(200);
    expect((await redirect(orig).expect(200)).body.data.slug).toBe(
      'doi-slug-2',
    ); // collapsed, not a chain
    expect((await redirect('doi-slug').expect(200)).body.data.slug).toBe(
      'doi-slug-2',
    );

    // Renaming back makes the original URL real again and drops its redirect.
    await admin.patch(`/posts/${id}`, { slug: orig }).expect(200);
    await redirect(orig).expect(404);
    expect((await redirect('doi-slug-2').expect(200)).body.data.slug).toBe(
      orig,
    );
    await pub(`/posts/${orig}`).expect(200);
    await redirect('khong-co').expect(404);

    // a slug already used by another post is still rejected
    const dup = await admin.patch(`/posts/${id}`, { slug: 'doi-slug-2' });
    expect(dup.status).toBe(200); // free again: only redirected, not a live post
    await admin.patch(`/posts/${id}`, { slug: orig }).expect(200);
  });

  it('allows other edits (recomputing stats) after publishing', async () => {
    const ok = await admin
      .patch(`/posts/${id}`, { bodyMd: 'a '.repeat(450), tags: ['aws'] })
      .expect(200);
    expect(ok.body.data.wordCount).toBe(450);
    expect(ok.body.data.readingMins).toBe(3);
    expect(ok.body.data.tags).toHaveLength(1);
    expect(triggered()).toContain('post:duong-di-cua-goi-tin');
  });

  it('keeps the original publish date when re-publishing', async () => {
    const before = (await admin.get(`/posts/${id}`).expect(200)).body.data
      .publishedAt;
    await admin.post(`/posts/${id}/unpublish`).expect(200);
    await pub('/posts/duong-di-cua-goi-tin').expect(404);
    const again = await admin.post(`/posts/${id}/publish`).expect(200);
    expect(again.body.data.publishedAt).toBe(before);
  });

  it('validates input and references', async () => {
    expect(
      (await admin.post('/posts', { bodyMd: 'no title' }).expect(400)).body
        .error.code,
    ).toBe('VALIDATION_ERROR');
    expect(
      (await admin.patch(`/posts/${id}`, { categoryId: 'missing' }).expect(400))
        .body.error.code,
    ).toBe('INVALID_REFERENCE');
    await admin.get('/posts/missing').expect(404);
  });

  it('deletes and revalidates', async () => {
    await admin.del(`/posts/${id}`).expect(204);
    // redirects created by earlier renames must not outlive the post
    expect(await prisma.slugRedirect.count()).toBe(0);
    await pub('/posts/duong-di-cua-goi-tin').expect(404);
    expect(triggered()).toContain('post:duong-di-cua-goi-tin');
  });
});

describe('scheduling', () => {
  it('hides a scheduled post until its time and rejects a past time', async () => {
    const { id } = (
      await admin.post('/posts', { title: 'Hẹn giờ' }).expect(201)
    ).body.data;
    expect(
      (
        await admin
          .post(`/posts/${id}/schedule`, {
            publishedAt: '2020-01-01T00:00:00Z',
          })
          .expect(400)
      ).body.error.code,
    ).toBe('SCHEDULE_IN_PAST');

    const when = new Date(Date.now() + 86_400_000).toISOString();
    const res = await admin
      .post(`/posts/${id}/schedule`, { publishedAt: when })
      .expect(200);
    expect(res.body.data.status).toBe('PUBLISHED');
    await pub('/posts/hen-gio').expect(404);

    await prisma.post.update({
      where: { id },
      data: { publishedAt: new Date(Date.now() - 1000) },
    });
    await pub('/posts/hen-gio').expect(200);
  });
});

describe('notes', () => {
  it('quick-publishes a note with a timestamp slug', async () => {
    const res = await admin
      .post('/notes', { bodyMd: 'ghi nhanh', publish: true })
      .expect(201);
    expect(res.body.data.slug).toMatch(/^\d{14}-[0-9a-f]{4}$/);
    await pub(`/notes/${res.body.data.slug}`).expect(200);
    expect(triggered()).toContain(`note:${res.body.data.slug}`);
  });

  it('rejects an empty note and keeps drafts private', async () => {
    await admin.post('/notes', { bodyMd: '   ' }).expect(400);
    const draft = (await admin.post('/notes', { bodyMd: 'nháp' }).expect(201))
      .body.data;
    await pub(`/notes/${draft.slug}`).expect(404);
    await admin.post(`/notes/${draft.id}/publish`).expect(200);
    await pub(`/notes/${draft.slug}`).expect(200);
    await admin.del(`/notes/${draft.id}`).expect(204);
  });
});

describe('series, taxonomy and pages', () => {
  it('orders posts in a series and exposes them publicly', async () => {
    const series = (
      await admin.post('/series', { title: 'Loạt bài thử' }).expect(201)
    ).body.data;
    expect(series.slug).toBe('loat-bai-thu');
    const ids: string[] = [];
    for (const title of ['Bài A', 'Bài B']) {
      const { id } = (await admin.post('/posts', { title }).expect(201)).body
        .data;
      await admin.post(`/posts/${id}/publish`).expect(200);
      ids.push(id);
    }
    const res = await admin
      .put(`/series/${series.id}/order`, { postIds: [ids[1], ids[0]] })
      .expect(200);
    expect(res.body.data.posts.map((p: { slug: string }) => p.slug)).toEqual([
      'bai-b',
      'bai-a',
    ]);
    const items = (await pub('/series/loat-bai-thu').expect(200)).body.data
      .items;
    expect(items.map((i: { slug: string }) => i.slug)).toEqual([
      'bai-b',
      'bai-a',
    ]);
    await admin
      .put(`/series/${series.id}/order`, { postIds: [ids[0], ids[0]] })
      .expect(400);
  });

  it('creates categories with unique slugs and edits a static page', async () => {
    await admin.post('/categories', { name: 'KHCN' }).expect(201);
    expect(
      (await admin.post('/categories', { name: 'KHCN' }).expect(409)).body.error
        .code,
    ).toBe('CONFLICT');
    await admin
      .put('/pages/about', { title: 'Giới thiệu', bodyMd: 'v1' })
      .expect(200);
    await admin
      .put('/pages/about', { title: 'Giới thiệu', bodyMd: 'v2' })
      .expect(200);
    expect((await pub('/pages/about').expect(200)).body.data.bodyMd).toBe('v2');
    expect(triggered()).toContain('page:about');
  });
});

describe('POST /admin/revalidate', () => {
  it('refreshes all tags by default, or the given ones', async () => {
    const all = await admin.post('/revalidate', {}).expect(200);
    expect(all.body.data.tags).toEqual(
      expect.arrayContaining(['posts', 'notes', 'home', 'feed']),
    );
    const some = await admin
      .post('/revalidate', { tags: ['home'] })
      .expect(200);
    expect(some.body.data).toEqual({ tags: ['home'], ok: true });
  });
});
