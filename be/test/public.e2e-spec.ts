import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { API, createApp, resetDb, seedAdmin } from './helpers';

const prisma = new PrismaClient();
let app: INestApplication;
const get = (path: string) => request(app.getHttpServer()).get(`${API}${path}`);

const day = (iso: string) => new Date(iso);
const future = new Date(Date.now() + 7 * 864e5);

beforeAll(async () => {
  await resetDb(prisma);
  const admin = await seedAdmin(prisma);
  const khcn = await prisma.category.create({
    data: { slug: 'khcn', name: 'KHCN' },
  });
  const khac = await prisma.category.create({
    data: { slug: 'khac', name: 'Khác' },
  });
  const tag = await prisma.tag.create({ data: { slug: 'aws', name: 'aws' } });
  const series = await prisma.series.create({
    data: {
      slug: 'btb',
      title: 'Back To Basics',
      featured: true,
      featuredOrder: 1,
    },
  });

  const post = (slug: string, extra: object) =>
    prisma.post.create({
      data: {
        slug,
        title: `T ${slug}`,
        bodyMd: 'nội dung',
        authorId: admin.id,
        status: 'PUBLISHED',
        ...extra,
      },
    });
  await post('p-2024', {
    publishedAt: day('2024-05-01T00:00:00Z'),
    categoryId: khac.id,
  });
  const p2 = await post('p-2025', {
    publishedAt: day('2025-05-01T00:00:00Z'),
    categoryId: khcn.id,
    seriesId: series.id,
    seriesOrder: 1,
    featured: true,
  });
  await prisma.postTag.create({ data: { postId: p2.id, tagId: tag.id } });
  await post('p-2026', {
    publishedAt: day('2026-05-01T00:00:00Z'),
    categoryId: khcn.id,
    seriesId: series.id,
    seriesOrder: 2,
  });
  await post('scheduled', { publishedAt: future });
  await post('draft', { status: 'DRAFT', publishedAt: null });
  await post('info-1', {
    kind: 'INFOGRAPHIC',
    publishedAt: day('2026-06-01T00:00:00Z'),
  });

  const note = (slug: string, extra: object) =>
    prisma.note.create({
      data: {
        slug,
        bodyMd: `ghi chú ${slug}`,
        authorId: admin.id,
        status: 'PUBLISHED',
        ...extra,
      },
    });
  await note('n-oct', { publishedAt: day('2026-10-14T09:00:00Z') });
  // 17:30Z on Sep 30 is already Oct 1 in Vietnam (UTC+7): must be listed under October.
  await note('n-boundary', { publishedAt: day('2026-09-30T17:30:00Z') });
  await note('n-sep', { publishedAt: day('2026-09-15T00:00:00Z') });
  await note('n-draft', { status: 'DRAFT', publishedAt: null });
  await note('n-future', { publishedAt: future });

  await prisma.page.create({
    data: { slug: 'about', title: 'Giới thiệu', bodyMd: 'xin chào' },
  });
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('GET /health, /site', () => {
  it('reports database health', async () => {
    const res = await get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns site info', async () => {
    const res = await get('/site').expect(200);
    expect(res.body.data.name).toBe('Salmon Lab');
    expect(res.body.data.nav.length).toBeGreaterThan(0);
  });
});

describe('GET /posts', () => {
  it('lists only published, already-live posts, newest first, without bodies', async () => {
    const res = await get('/posts').expect(200);
    const slugs = res.body.data.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual(['p-2026', 'p-2025', 'p-2024']);
    expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 3 });
    expect(res.body.data[0]).not.toHaveProperty('bodyMd');
  });

  it('paginates', async () => {
    const res = await get('/posts?page=2&pageSize=2').expect(200);
    expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual([
      'p-2024',
    ]);
    expect(res.body.meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it.each([
    ['category=khcn', ['p-2026', 'p-2025']],
    ['tag=aws', ['p-2025']],
    ['year=2024', ['p-2024']],
    ['q=P-2025', ['p-2025']],
  ])('filters by %s', async (qs, expected) => {
    const res = await get(`/posts?${qs}`).expect(200);
    expect(res.body.data.map((p: { slug: string }) => p.slug)).toEqual(
      expected,
    );
  });

  it('returns slugs only with fields=slug', async () => {
    const res = await get('/posts?fields=slug').expect(200);
    expect(res.body.data).toEqual([
      { slug: 'p-2026' },
      { slug: 'p-2025' },
      { slug: 'p-2024' },
    ]);
  });

  it('separates infographics from posts and aliases them', async () => {
    const viaKind = await get('/posts?kind=infographic').expect(200);
    const alias = await get('/infographics').expect(200);
    expect(viaKind.body.data.map((p: { slug: string }) => p.slug)).toEqual([
      'info-1',
    ]);
    expect(alias.body.data).toEqual(viaKind.body.data);
  });

  it('rejects invalid query values with the error envelope', async () => {
    const res = await get('/posts?pageSize=0').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /posts/:slug', () => {
  it('returns the post with body, neighbours and series siblings', async () => {
    const res = await get('/posts/p-2025').expect(200);
    expect(res.body.data.bodyMd).toBe('nội dung');
    expect(res.body.data.prev.slug).toBe('p-2024');
    expect(res.body.data.next.slug).toBe('p-2026');
    expect(
      res.body.data.seriesPosts.map((p: { slug: string }) => p.slug),
    ).toEqual(['p-2025', 'p-2026']);
    expect(res.body.data.tags.map((t: { slug: string }) => t.slug)).toEqual([
      'aws',
    ]);
  });

  it.each(['draft', 'scheduled', 'does-not-exist'])(
    'hides %s with 404 POST_NOT_FOUND',
    async (slug) => {
      const res = await get(`/posts/${slug}`).expect(404);
      expect(res.body.error.code).toBe('POST_NOT_FOUND');
    },
  );

  it('keeps posts and infographics on separate URLs', async () => {
    await get('/posts/info-1').expect(404);
    await get('/infographics/p-2025').expect(404);
    await get('/infographics/info-1').expect(200);
  });
});

describe('GET /notes', () => {
  const slugs = (res: request.Response) =>
    res.body.data.map((n: { slug: string }) => n.slug);

  it('lists published notes only, newest first', async () => {
    const res = await get('/notes').expect(200);
    expect(slugs(res)).toEqual(['n-oct', 'n-boundary', 'n-sep']);
    expect(res.body.meta.total).toBe(3);
  });

  it('filters by month using Vietnam time', async () => {
    expect(slugs(await get('/notes?year=2026&month=10').expect(200))).toEqual([
      'n-oct',
      'n-boundary',
    ]);
    expect(slugs(await get('/notes?year=2026&month=9').expect(200))).toEqual([
      'n-sep',
    ]);
    expect(slugs(await get('/notes?year=2025').expect(200))).toEqual([]);
  });

  it('lists the available years and months (Vietnam time)', async () => {
    const res = await get('/notes/archive').expect(200);
    expect(res.body.data).toEqual([{ year: 2026, months: [10, 9] }]);
  });

  it('validates month range', async () => {
    await get('/notes?year=2026&month=13').expect(400);
  });

  it('serves a note by slug and hides drafts', async () => {
    const res = await get('/notes/n-oct').expect(200);
    expect(res.body.data.bodyMd).toBe('ghi chú n-oct');
    const missing = await get('/notes/n-draft').expect(404);
    expect(missing.body.error.code).toBe('NOTE_NOT_FOUND');
    await get('/notes/n-future').expect(404);
  });
});

describe('series, pages, taxonomy, home, feed', () => {
  it('returns a series with its published items in order', async () => {
    const res = await get('/series/btb').expect(200);
    expect(res.body.data.items.map((i: { slug: string }) => i.slug)).toEqual([
      'p-2025',
      'p-2026',
    ]);
    expect((await get('/series/nope').expect(404)).body.error.code).toBe(
      'SERIES_NOT_FOUND',
    );
  });

  it('returns static pages', async () => {
    expect((await get('/pages/about').expect(200)).body.data.title).toBe(
      'Giới thiệu',
    );
    expect((await get('/pages/nope').expect(404)).body.error.code).toBe(
      'PAGE_NOT_FOUND',
    );
  });

  it('counts only public posts in taxonomy', async () => {
    const cats = (await get('/taxonomy/categories').expect(200)).body.data;
    expect(
      Object.fromEntries(
        cats.map((c: { slug: string; postCount: number }) => [
          c.slug,
          c.postCount,
        ]),
      ),
    ).toEqual({
      khcn: 2,
      khac: 1,
    });
    const tags = (await get('/taxonomy/tags').expect(200)).body.data;
    expect(tags).toEqual([
      expect.objectContaining({ slug: 'aws', postCount: 1 }),
    ]);
  });

  it('builds the home payload', async () => {
    const { data } = (await get('/home').expect(200)).body;
    expect(data.featured.posts.map((p: { slug: string }) => p.slug)).toEqual([
      'p-2025',
    ]);
    expect(data.featured.series.map((s: { slug: string }) => s.slug)).toEqual([
      'btb',
    ]);
    expect(data.recentPosts.map((p: { slug: string }) => p.slug)).toEqual([
      'p-2026',
      'p-2025',
      'p-2024',
    ]);
    expect(data.recentNotes.map((n: { slug: string }) => n.slug)).toEqual([
      'n-oct',
      'n-boundary',
      'n-sep',
    ]);
  });

  it('feeds list public content only', async () => {
    const rss = (await get('/feed/rss').expect(200)).body.data;
    expect(rss.items.map((i: { path: string }) => i.path)).toEqual([
      '/infographic/info-1',
      '/posts/p-2026',
      '/posts/p-2025',
      '/posts/p-2024',
    ]);
    const paths = (await get('/feed/sitemap').expect(200)).body.data.map(
      (e: { path: string }) => e.path,
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/posts/p-2025',
        '/notes/n-oct',
        '/series/btb',
        '/about',
      ]),
    );
    expect(paths).not.toContain('/posts/draft');
    expect(paths).not.toContain('/posts/scheduled');
    expect(paths).not.toContain('/notes/n-draft');
  });
});
