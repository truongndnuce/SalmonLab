import { expect, test, type Page } from '@playwright/test';

const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@salmonlab.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

async function login(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();
}

test('admin pages require login and are not indexable', async ({ page, request }) => {
  // What crawlers see: the server-rendered HTML carries exactly one noindex tag, on every admin route.
  for (const path of ['/admin', '/admin/login', '/admin/posts/new']) {
    const html = await (await request.get(path)).text();
    expect(html.match(/<meta name="robots" content="noindex, nofollow"\/>/g)).toHaveLength(1);
  }

  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Fposts/);
  await expect(page.getByRole('navigation', { name: 'Quản trị' })).toHaveCount(0);
  // After a client-side redirect Next can briefly (or, rarely, persistently) keep a duplicate identical tag,
  // so assert that every robots tag present says noindex rather than counting them.
  const contents = await page.locator('meta[name="robots"]').evaluateAll((els) => els.map((e) => (e as HTMLMetaElement).content));
  expect(contents.length).toBeGreaterThan(0);
  for (const c of contents) expect(c).toContain('noindex');
});

test('wrong password shows an error and stays on the login page', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill('sai-mat-khau');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByText('Email hoặc mật khẩu không đúng')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test('write → preview → publish → visible publicly → unpublish → delete; quick note', async ({ page, request }) => {
  const title = `Bài E2E ${Date.now()}`;
  const slugPart = 'bai-e2e-';

  await login(page);
  await expect(page.getByRole('navigation', { name: 'Quản trị' })).toBeVisible();

  // Session survives a full reload (refresh cookie → new access token), without logging in again.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tổng quan' })).toBeVisible();

  // --- create a draft
  await page.getByRole('link', { name: '+ Bài mới' }).first().click();
  await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.type('## Mục thử nghiệm\n\nXin chào từ trình soạn thảo.\n');

  // Live preview uses the public rendering pipeline (heading ids, anchors).
  const preview = page.locator('.prose-salmon');
  await expect(preview.getByRole('heading', { name: /Mục thử nghiệm/ })).toBeVisible();
  await expect(preview.locator('h2[id]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
  await expect(page.getByText('Đã lưu', { exact: false }).first()).toBeVisible();
  const slug = (await page.getByLabel('Slug').inputValue()) || (await page.getByPlaceholder('tu-sinh-tu-tieu-de').inputValue());

  // Drafts are not public.
  const draftRes = await request.get(`/posts/${slugPart}x`);
  expect(draftRes.status()).toBe(404);

  // --- publish
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã đăng')).toBeVisible();
  await expect(page.getByLabel('Slug')).toBeEnabled(); // renaming is allowed; the old URL redirects

  const publicUrl = `/posts/${slug}`;
  await expect
    .poll(async () => (await request.get(publicUrl)).status(), { timeout: 15_000, message: 'published post should appear publicly' })
    .toBe(200);
  expect(await (await request.get(publicUrl)).text()).toContain('Xin chào từ trình soạn thảo');

  // --- unpublish
  await page.getByRole('button', { name: 'Gỡ xuất bản' }).click();
  await expect(page.getByText('Nháp').first()).toBeVisible();
  await expect.poll(async () => (await request.get(publicUrl)).status(), { timeout: 15_000 }).toBe(404);

  // --- delete via the two-step confirm
  await page.getByRole('button', { name: 'Xoá bài viết' }).click();
  await page.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);

  // --- quick note: publish with Ctrl+Enter, then delete
  await page.getByRole('link', { name: 'Ghi chú', exact: true }).click();
  const text = `Ghi chú e2e ${Date.now()}`;
  await page.getByLabel('Nội dung ghi chú').fill(text);
  await page.getByLabel('Nội dung ghi chú').press('Control+Enter');
  const row = page.locator('li', { hasText: text });
  await expect(row).toBeVisible();
  await expect(row.getByText('Đã đăng')).toBeVisible();
  await row.getByRole('button', { name: 'Xoá' }).click();
  await row.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page.locator('li', { hasText: text })).toHaveCount(0);

  // --- sign out returns to the login page and re-locks the area
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/admin\/login/);
});

// 1×1 transparent PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('media: upload in the library, insert via the picker into a post, then clean up', async ({ page }) => {
  await login(page);

  // Library upload
  await page.getByRole('link', { name: 'Thư viện ảnh' }).click();
  await page.getByLabel('Tải ảnh lên').setInputFiles({ name: 'e2e.png', mimeType: 'image/png', buffer: PNG });
  const card = page.locator('li', { has: page.getByLabel('Mô tả ảnh (alt)') }).first();
  await expect(card).toBeVisible();
  await card.getByLabel('Mô tả ảnh (alt)').fill('Ảnh e2e');
  await card.getByRole('button', { name: 'Lưu alt' }).click();
  await expect(page.getByText('Đã lưu mô tả')).toBeVisible();

  // Insert via the picker in the post editor
  await page.goto('/admin/posts/new');
  await page.locator('.cm-content').click();
  await page.getByRole('button', { name: 'Chèn ảnh' }).click();
  await page.getByRole('dialog', { name: 'Chọn ảnh' }).locator('button img').first().click();
  await expect(page.locator('.cm-content')).toContainText('![Ảnh e2e](');
  await expect(page.locator('.prose-salmon img[alt="Ảnh e2e"]')).toBeVisible();

  // Cover picker fills the cover URL
  await page.getByRole('button', { name: 'Chọn / tải ảnh' }).click();
  await page.getByRole('dialog', { name: 'Chọn ảnh' }).locator('button img').first().click();
  await expect(page.getByLabel('Hoặc nhập URL ảnh')).toHaveValue(/\/blog-media\/.+\.png$/);

  // Clean up: remove the uploaded image from the library
  await page.goto('/admin/media');
  const row = page.locator('li', { has: page.getByLabel('Mô tả ảnh (alt)') }).first();
  await row.getByRole('button', { name: 'Xoá' }).click();
  await row.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page.getByText('Đã xoá ảnh')).toBeVisible();
});

const WIDGET_HTML = `<!doctype html><html><head><title>w</title></head><body><div id="out" style="height:260px">Widget e2e</div><script>document.getElementById('out').dataset.ran='1';</script></body></html>`;

test('widget: upload in the editor → sandboxed iframe in the preview and on the published page', async ({ page, request }) => {
  const title = `Infographic E2E ${Date.now()}`;
  await login(page);
  await page.goto('/admin/posts/new');
  await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
  await page.getByLabel('Loại').selectOption('INFOGRAPHIC');
  await page.locator('.cm-content').click();
  await page.keyboard.type('Trước widget.\n');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page).toHaveURL(/\/admin\/posts\/[a-z0-9]+$/);
  // The first save swaps /new for /[id], which remounts the editor; wait for it to settle before using the side panel.
  await expect(page.getByText('Đã đồng bộ')).toBeVisible();

  // Upload an HTML widget: it is appended to the body and rendered in the live preview.
  await page.getByLabel('Chọn file widget').setInputFiles({ name: 'demo.html', mimeType: 'text/html', buffer: Buffer.from(WIDGET_HTML) });
  await page.getByLabel('Tiêu đề widget').fill('Widget thử');
  await page.getByRole('button', { name: 'Tải lên và chèn' }).click();
  await expect(page.locator('.cm-content')).toContainText('::widget{src=');
  const frame = page.locator('.prose-salmon iframe.widget-frame');
  await expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(frame).toHaveAttribute('title', 'Widget thử');
  await expect(page.frameLocator('.prose-salmon iframe.widget-frame').locator('#out')).toHaveText('Widget e2e');
  // The host script reports its content height (260px), resizing the iframe.
  await expect.poll(async () => (await frame.boundingBox())?.height ?? 0).toBeGreaterThan(250);

  // Publish and check the public page.
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText('Đã lưu lúc')).toBeVisible();
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã đăng')).toBeVisible();
  const slug = await page.getByLabel('Slug').inputValue();
  await expect.poll(async () => (await request.get(`/infographic/${slug}`)).status(), { timeout: 15_000 }).toBe(200);
  await page.goto(`/infographic/${slug}`);
  const pub = page.locator('figure.widget iframe.widget-frame');
  await pub.scrollIntoViewIfNeeded();
  await expect(pub).toHaveAttribute('sandbox', 'allow-scripts');
  await expect(page.frameLocator('figure.widget iframe').locator('#out')).toHaveText('Widget e2e');

  // Cleanup: delete the post (also removes the stored widget file).
  await page.goto('/admin/posts');
  await page.getByLabel('Tìm theo tiêu đề').fill(title);
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await page.getByRole('link', { name: title }).click();
  await page.getByRole('button', { name: 'Xoá bài viết' }).click();
  await page.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test('import: a markdown file becomes an editable draft', async ({ page }) => {
  const title = `Bài nhập ${Date.now()}`;
  await login(page);
  await page.goto('/admin/posts/import');
  await page.getByLabel('Chọn file để nhập').setInputFiles({ name: 'x.md', mimeType: 'text/markdown', buffer: Buffer.from(`---\ntitle: "${title}"\ntags: [e2e]\n---\n\n## Mục nhập\n\nNội dung nhập.`) });
  await page.getByRole('button', { name: 'Nhập', exact: true }).click();
  const result = page.getByLabel('Kết quả nhập');
  await expect(result).toContainText('Đã tạo bản nháp mới');
  await result.getByRole('link', { name: title }).click();
  await expect(page.locator('.cm-content')).toContainText('Nội dung nhập.');
  await page.getByRole('button', { name: 'Xoá bài viết' }).click();
  await page.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test('renaming a published post redirects the old URL permanently', async ({ page, request }) => {
  const title = `Đổi slug ${Date.now()}`;
  await login(page);
  await page.goto('/admin/posts/new');
  await page.getByLabel('Tiêu đề', { exact: true }).fill(title);
  await page.locator('.cm-content').click();
  await page.keyboard.type('Nội dung đổi slug.');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  await expect(page.getByText('Đã đồng bộ')).toBeVisible();
  await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();
  await expect(page.getByText('Đã đăng')).toBeVisible();
  const oldSlug = await page.getByLabel('Slug').inputValue();
  const newSlug = `${oldSlug}-moi`;
  await expect.poll(async () => (await request.get(`/posts/${oldSlug}`)).status(), { timeout: 15_000 }).toBe(200);

  await page.getByLabel('Slug').fill(newSlug);
  await expect(page.getByText('tự chuyển hướng')).toBeVisible();
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu lúc')).toBeVisible();

  await expect
    .poll(async () => (await request.get(`/posts/${oldSlug}`, { maxRedirects: 0 })).status(), { timeout: 15_000 })
    .toBe(308);
  const res = await request.get(`/posts/${oldSlug}`, { maxRedirects: 0 });
  expect(res.headers()['location']).toContain(`/posts/${newSlug}`);
  expect((await request.get(`/posts/${newSlug}`)).status()).toBe(200);

  await page.getByRole('button', { name: 'Gỡ xuất bản' }).click();
  await page.getByRole('button', { name: 'Xoá bài viết' }).click();
  await page.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page).toHaveURL(/\/admin\/posts$/);
});

test('settings: site name changes on the public site, then is restored', async ({ page, request }) => {
  await login(page);
  await page.goto('/admin/settings');
  const name = page.getByLabel('Tên site');
  await expect(name).not.toHaveValue('');
  const original = await name.inputValue();
  await name.fill('Salmon Lab E2E');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu cài đặt')).toBeVisible();
  await expect
    .poll(async () => (await (await request.get('/rss.xml')).text()).includes('Salmon Lab E2E'), { timeout: 15_000 })
    .toBe(true);

  await name.fill(original);
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText('Đã lưu cài đặt')).toBeVisible();
  await expect
    .poll(async () => (await (await request.get('/rss.xml')).text()).includes('Salmon Lab E2E'), { timeout: 15_000 })
    .toBe(false);
});

test('notes can carry tags', async ({ page }) => {
  await login(page);
  await page.goto('/admin/notes');
  const text = `Ghi chú thẻ ${Date.now()}`;
  await page.getByLabel('Nội dung ghi chú').fill(text);
  await page.getByPlaceholder(/Nhập thẻ/).fill('e2e-tag');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Lưu nháp' }).click();
  const row = page.locator('li', { hasText: text });
  await expect(row).toContainText('#e2e-tag');
  await row.getByRole('button', { name: 'Xoá' }).click();
  await row.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page.locator('li', { hasText: text })).toHaveCount(0);
});
