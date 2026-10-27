import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';
import { API, createApp, resetDb, seedAdmin } from './helpers';

const prisma = new PrismaClient();
let app: INestApplication;
const search = (qs: string) =>
  request(app.getHttpServer()).get(`${API}/search?${qs}`);
const past = new Date(Date.now() - 86_400_000);

beforeAll(async () => {
  await resetDb(prisma);
  const admin = await seedAdmin(prisma);
  const post = (
    slug: string,
    title: string,
    bodyMd: string,
    extra: object = {},
  ) =>
    prisma.post.create({
      data: {
        slug,
        title,
        bodyMd,
        authorId: admin.id,
        status: 'PUBLISHED',
        publishedAt: past,
        ...extra,
      },
    });
  await post(
    'dien-toan-dam-may',
    'Điện toán đám mây cho người mới',
    'Giới thiệu về hạ tầng và dịch vụ đám mây.',
  );
  await post(
    'do-luong',
    'Đo lường trước khi tối ưu',
    'Hãy đo trước. Nhắc tới điện toán một lần trong thân bài.',
  );
  await post('nhap', 'Điện toán nháp', 'Bản nháp không được lộ.', {
    status: 'DRAFT',
  });
  await post('tuong-lai', 'Điện toán hẹn giờ', 'Chưa tới giờ.', {
    publishedAt: new Date(Date.now() + 86_400_000),
  });
  await post('hoat-anh', 'Hoạt ảnh polling', 'Điện toán phân tán.', {
    kind: 'INFOGRAPHIC',
  });
  await prisma.note.create({
    data: {
      slug: '20260101000000-aaaa',
      bodyMd: 'Ghi chú ngắn về điện toán biên',
      authorId: admin.id,
      status: 'PUBLISHED',
      publishedAt: past,
    },
  });
  await prisma.note.create({
    data: {
      slug: '20260101000001-bbbb',
      bodyMd: 'Ghi chú nháp điện toán',
      authorId: admin.id,
      status: 'DRAFT',
    },
  });
  app = await createApp();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('GET /search', () => {
  it('finds accented content from an unaccented, mixed-case query', async () => {
    const res = await search(
      `q=${encodeURIComponent('DIEN toan dam MAY')}`,
    ).expect(200);
    expect(res.body.data[0]).toMatchObject({
      type: 'post',
      slug: 'dien-toan-dam-may',
    });
    expect(res.body.data[0].snippet).toContain('đám mây');
  });

  it('matches prefixes while typing and ranks a title hit above a body-only hit', async () => {
    const res = await search('q=dien+to').expect(200);
    const slugs = res.body.data.map((r: { slug: string }) => r.slug);
    expect(slugs.indexOf('dien-toan-dam-may')).toBeLessThan(
      slugs.indexOf('do-luong'),
    );
  });

  it('never returns drafts or not-yet-published items', async () => {
    const res = await search('q=dien+toan&pageSize=30').expect(200);
    const slugs = res.body.data.map((r: { slug: string }) => r.slug);
    expect(slugs).not.toContain('nhap');
    expect(slugs).not.toContain('tuong-lai');
    expect(slugs).not.toContain('20260101000001-bbbb');
    expect(res.body.meta.total).toBe(res.body.data.length);
  });

  it('mixes posts, infographics and notes, labelled by type, and filters by type', async () => {
    const all = await search('q=dien+toan&pageSize=30').expect(200);
    expect(new Set(all.body.data.map((r: { type: string }) => r.type))).toEqual(
      new Set(['post', 'infographic', 'note']),
    );
    const notes = await search('q=dien+toan&type=note').expect(200);
    expect(notes.body.data.map((r: { type: string }) => r.type)).toEqual([
      'note',
    ]);
    expect(notes.body.data[0].title).toContain('Ghi chú ngắn');
    const info = await search('q=dien+toan&type=infographic').expect(200);
    expect(info.body.data.map((r: { slug: string }) => r.slug)).toEqual([
      'hoat-anh',
    ]);
  });

  it('paginates and reports the total', async () => {
    const p1 = await search('q=dien+toan&pageSize=2&page=1').expect(200);
    const p2 = await search('q=dien+toan&pageSize=2&page=2').expect(200);
    expect(p1.body.data).toHaveLength(2);
    expect(p1.body.meta.total).toBe(4);
    expect(p2.body.data).toHaveLength(2);
    expect(p1.body.data[0].slug).not.toBe(p2.body.data[0].slug);
  });

  it('is safe against query syntax and LIKE wildcards, and validates input', async () => {
    for (const q of ["a' OR 1=1 --", '(:*) | !x', '%%', '_\\_']) {
      await search(`q=${encodeURIComponent(q)}`).expect(200);
    }
    expect((await search('q=%25%25').expect(200)).body.data).toEqual([]);
    const short = await search('q=a').expect(400);
    expect(short.body.error.code).toBe('VALIDATION_ERROR');
    await search('').expect(400);
  });

  it('returns an empty list when nothing matches', async () => {
    const res = await search('q=khongcokhoanao').expect(200);
    expect(res.body).toMatchObject({ data: [], meta: { total: 0 } });
  });
});
