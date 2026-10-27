import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as AdmZip from 'adm-zip';
import * as sharp from 'sharp';
import * as request from 'supertest';
import { API, createApp, loginAdmin, resetDb, seedAdmin } from './helpers';

const prisma = new PrismaClient();
let app: INestApplication;
let auth: { Authorization: string };
const http = () => request(app.getHttpServer());

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: '#7c4530' } })
    .png()
    .toBuffer();

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

describe('admin media', () => {
  it('requires authentication', async () => {
    await http().get(`${API}/admin/media`).expect(401);
    await http()
      .post(`${API}/admin/media`)
      .attach('file', await png(10, 10), 'a.png')
      .expect(401);
  });

  it('uploads an image, serves it publicly, lists, edits alt and deletes it', async () => {
    const res = await http()
      .post(`${API}/admin/media`)
      .set(auth)
      .field('alt', 'Ảnh thử')
      .attach('file', await png(40, 30), {
        filename: 'x.png',
        contentType: 'image/png',
      })
      .expect(201);
    const m = res.body.data;
    expect(m).toMatchObject({
      mimeType: 'image/png',
      width: 40,
      height: 30,
      alt: 'Ảnh thử',
    });
    expect(m.key).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);

    const file = await fetch(m.url);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');

    const list = await http().get(`${API}/admin/media`).set(auth).expect(200);
    expect(list.body.meta.total).toBe(1);

    const patched = await http()
      .patch(`${API}/admin/media/${m.id}`)
      .set(auth)
      .send({ alt: '' })
      .expect(200);
    expect(patched.body.data.alt).toBeNull();

    await http().delete(`${API}/admin/media/${m.id}`).set(auth).expect(200);
    expect((await fetch(m.url)).status).toBe(404);
    await http().delete(`${API}/admin/media/${m.id}`).set(auth).expect(404);
  });

  it('downscales oversized images', async () => {
    const res = await http()
      .post(`${API}/admin/media`)
      .set(auth)
      .attach('file', await png(3000, 1000), 'big.png')
      .expect(201);
    expect(res.body.data.width).toBe(2400);
    expect(res.body.data.height).toBe(800);
  });

  it('rejects SVG, non-images and a missing file', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const a = await http()
      .post(`${API}/admin/media`)
      .set(auth)
      .attach('file', svg, { filename: 'x.png', contentType: 'image/png' });
    expect(a.status).toBe(400);
    const b = await http()
      .post(`${API}/admin/media`)
      .set(auth)
      .attach('file', Buffer.from('hello'), 'x.png');
    expect(b.status).toBe(400);
    expect(b.body.error.code).toBe('INVALID_IMAGE');
    const c = await http().post(`${API}/admin/media`).set(auth);
    expect(c.body.error.code).toBe('FILE_REQUIRED');
  });

  it('rejects files over 10 MB with 413', async () => {
    const res = await http()
      .post(`${API}/admin/media`)
      .set(auth)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'huge.png');
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('admin import', () => {
  const importFile = (
    data: Buffer,
    filename: string,
    fields: Record<string, string> = {},
  ) => {
    const r = http()
      .post(`${API}/admin/import`)
      .set(auth)
      .attach('file', data, filename);
    for (const [k, v] of Object.entries(fields)) r.field(k, v);
    return r;
  };

  it('imports a .md as a draft with tags, category, excerpt and the original date', async () => {
    await prisma.category.create({ data: { slug: 'khcn', name: 'KHCN' } });
    const md =
      '---\ntitle: Bài nhập\nslug: bai-nhap\ndescription: Tóm tắt\ntags: [x, y]\ncategories: [KHCN]\ndate: 2021-03-04\n---\n\n## Mục\n\nNội dung';
    const res = await importFile(Buffer.from(md), 'a.md').expect(201);
    expect(res.body.data).toMatchObject({
      slug: 'bai-nhap',
      status: 'DRAFT',
      excerpt: 'Tóm tắt',
    });
    expect(
      res.body.data.tags.map((t: { slug: string }) => t.slug).sort(),
    ).toEqual(['x', 'y']);
    expect(res.body.data.category.slug).toBe('khcn');
    expect(res.body.data.publishedAt).toContain('2021-03-04');
    expect(res.body.meta.outcome).toBe('created');
    // Still not public, because it's a draft even though publishedAt is in the past.
    await http().get(`${API}/posts/bai-nhap`).expect(404);
  });

  it('handles slug conflicts: rename (default), reject, overwrite', async () => {
    const md = (t: string) =>
      Buffer.from(`---\ntitle: ${t}\nslug: bai-nhap\n---\nthân ${t}`);
    const renamed = await importFile(md('Hai'), 'b.md').expect(201);
    expect(renamed.body.data.slug).toBe('bai-nhap-2');
    expect(renamed.body.meta.outcome).toBe('renamed');
    const rejected = await importFile(md('Ba'), 'c.md', {
      onConflict: 'reject',
    }).expect(409);
    expect(rejected.body.error.code).toBe('SLUG_TAKEN');
    const over = await importFile(md('Bốn'), 'd.md', {
      onConflict: 'overwrite',
    }).expect(201);
    expect(over.body.data).toMatchObject({
      slug: 'bai-nhap',
      title: 'Bốn',
      bodyMd: 'thân Bốn',
    });
    expect(over.body.meta.outcome).toBe('overwritten');
  });

  it('imports a .zip, uploading images referenced by the markdown and rewriting their links', async () => {
    const z = new AdmZip();
    z.addFile(
      'post/index.md',
      Buffer.from('# Bài có ảnh\n\n![Hình](img/a.png) ![Thiếu](img/none.png)'),
    );
    z.addFile('post/img/a.png', await png(8, 8));
    const res = await importFile(z.toBuffer(), 'post.zip').expect(201);
    expect(res.body.meta.uploadedImages).toBe(1);
    expect(res.body.meta.warnings).toEqual([
      expect.stringContaining('img/none.png'),
    ]);
    const url = /!\[Hình\]\((\S+)\)/.exec(res.body.data.bodyMd)![1];
    expect(url).toMatch(/\/blog-media-test\/.+\.png$/);
    expect((await fetch(url)).status).toBe(200);
  });

  it('rejects unsupported files, JS front matter, missing titles and unauthenticated calls', async () => {
    expect((await importFile(Buffer.from('x'), 'a.exe')).body.error.code).toBe(
      'UNSUPPORTED_FILE',
    );
    expect(
      (await importFile(Buffer.from('---js\n1\n---\nx'), 'a.md')).body.error
        .code,
    ).toBe('INVALID_FRONTMATTER');
    expect((await importFile(Buffer.from('  '), '.md')).body.error.code).toBe(
      'TITLE_REQUIRED',
    );
    await http()
      .post(`${API}/admin/import`)
      .attach('file', Buffer.from('x'), 'a.md')
      .expect(401);
  });
});

describe('widgets', () => {
  const html =
    '<!doctype html><html><head><title>w</title></head><body><div id="a">xin chào</div><script>document.getElementById("a").textContent+="!"</script></body></html>';
  let postId: string;

  beforeAll(async () => {
    const r = await http()
      .post(`${API}/admin/posts`)
      .set(auth)
      .send({ title: 'Có widget', kind: 'INFOGRAPHIC' })
      .expect(201);
    postId = r.body.data.id;
  });

  it('uploads a widget: validated, wrapped with CSP + host script, served as HTML, with a ready directive', async () => {
    const res = await http()
      .post(`${API}/admin/posts/${postId}/widgets`)
      .set(auth)
      .field('title', 'Hoạt ảnh "thử"')
      .attach('file', Buffer.from(html), 'Partial Failure.html')
      .expect(201);
    expect(res.body.data).toMatchObject({
      name: 'partial-failure.html',
      title: 'Hoạt ảnh "thử"',
    });
    expect(res.body.data.directive).toBe(
      `::widget{src="${res.body.data.url}" height="420" title="Hoạt ảnh 'thử'"}`,
    );
    expect(res.body.data.url).toContain(
      `/blog-widgets-test/widgets/${postId}/partial-failure.html`,
    );

    const served = await fetch(res.body.data.url);
    expect(served.status).toBe(200);
    expect(served.headers.get('content-type')).toContain('text/html');
    const text = await served.text();
    expect(text).toContain("connect-src 'none'");
    expect(text).toContain('widget-height');
    expect(text).toContain('xin chào');

    const list = await http()
      .get(`${API}/admin/posts/${postId}/widgets`)
      .set(auth)
      .expect(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('rejects unsafe widgets and missing titles', async () => {
    const bad = await http()
      .post(`${API}/admin/posts/${postId}/widgets`)
      .set(auth)
      .field('title', 'x')
      .attach(
        'file',
        Buffer.from('<div></div><script>fetch("https://evil")</script>'),
        'bad.html',
      );
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('WIDGET_INVALID');
    const noTitle = await http()
      .post(`${API}/admin/posts/${postId}/widgets`)
      .set(auth)
      .attach('file', Buffer.from(html), 'a.html');
    expect(noTitle.status).toBe(400);
    await http()
      .post(`${API}/admin/posts/nope/widgets`)
      .set(auth)
      .field('title', 'x')
      .attach('file', Buffer.from(html), 'a.html')
      .expect(404);
  });

  it('imports a zip with widgets: rewrites ::widget src, and rejects the whole import if one widget is unsafe', async () => {
    const md =
      '---\nkind: infographic\ntitle: Zip có widget\nslug: zip-co-widget\n---\n\nChữ\n\n::widget{src="widgets/one.html" height="300" title="Một"}\n\n::widget{src="widgets/missing.html" title="Thiếu"}\n';
    const z = new AdmZip();
    z.addFile('index.md', Buffer.from(md));
    z.addFile('widgets/one.html', Buffer.from(html));
    const res = await http()
      .post(`${API}/admin/import`)
      .set(auth)
      .attach('file', z.toBuffer(), 'p.zip')
      .expect(201);
    expect(res.body.meta.uploadedWidgets).toBe(1);
    expect(res.body.meta.warnings).toEqual([
      expect.stringContaining('widgets/missing.html'),
    ]);
    expect(res.body.data.kind).toBe('INFOGRAPHIC');
    const url = /::widget\{src="([^"]+one\.html)"/.exec(
      res.body.data.bodyMd,
    )![1];
    expect(url).toContain(`/widgets/${res.body.data.id}/one.html`);
    expect((await fetch(url)).status).toBe(200);

    // deleting the post removes the stored widget file
    await http()
      .delete(`${API}/admin/posts/${res.body.data.id}`)
      .set(auth)
      .expect(204);
    expect((await fetch(url)).status).toBe(404);

    const evil = new AdmZip();
    evil.addFile(
      'index.md',
      Buffer.from(
        '---\ntitle: Xấu\nslug: xau\n---\n::widget{src="w.html" title="x"}',
      ),
    );
    evil.addFile(
      'w.html',
      Buffer.from('<div></div><script>fetch("x")</script>'),
    );
    await http()
      .post(`${API}/admin/import`)
      .set(auth)
      .attach('file', evil.toBuffer(), 'e.zip')
      .expect(400);
    expect(await prisma.post.count({ where: { slug: 'xau' } })).toBe(0);
  });
});
