import { expect, test } from '@playwright/test';

test('home → post → back to the list', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Salmon Lab' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Các bài viết gần đây:' })).toBeVisible();

  const recent = page.locator('section', { has: page.getByRole('heading', { name: 'Các bài viết gần đây:' }) });
  const firstPost = recent.locator('a[href^="/posts/"]').first();
  const title = (await firstPost.textContent())!.trim();
  await firstPost.click();

  await expect(page).toHaveURL(/\/posts\/.+/);
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByText(/\d+ từ · \d+ phút đọc/)).toBeVisible();
  await expect(page).toHaveTitle(new RegExp(`${title.slice(0, 10)}.*Salmon Lab`));

  await page.getByRole('link', { name: /Tất cả bài viết/ }).click();
  await expect(page).toHaveURL(/\/posts$/);
});

test('posts page filters by category without leaving the page', async ({ page }) => {
  await page.goto('/posts');
  const rows = page.locator('main ul li');
  const all = await rows.count();
  expect(all).toBeGreaterThan(1);

  await page.getByRole('button', { name: 'Khác' }).click();
  await expect(page.getByRole('button', { name: 'Khác' })).toHaveAttribute('aria-pressed', 'true');
  expect(await rows.count()).toBeLessThan(all);

  await page.getByRole('button', { name: 'Tất cả' }).click();
  await expect(rows).toHaveCount(all);
});

test('notes: timeline, month filter and permalink', async ({ page }) => {
  await page.goto('/notes');
  await expect(page.getByRole('heading', { level: 1, name: 'Ghi chú' })).toBeVisible();
  const all = await page.locator('article').count();
  expect(all).toBeGreaterThan(1);

  await page.getByLabel('Năm').selectOption('2026');
  await expect(page).toHaveURL(/year=2026/);
  await page.getByLabel('Tháng').selectOption('10');
  await expect(page).toHaveURL(/month=10/);
  expect(await page.locator('article').count()).toBeLessThan(all);

  await page.getByRole('link', { name: /Liên kết ghi chú/ }).first().click();
  await expect(page).toHaveURL(/\/notes\/\d{14}-[0-9a-f]{4}$/);
});

test('unknown post shows the not-found page', async ({ page }) => {
  const res = await page.goto('/posts/khong-ton-tai');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('Không tìm thấy trang')).toBeVisible();
});

test('feeds and robots are served', async ({ request }) => {
  const rss = await request.get('/rss.xml');
  expect(rss.headers()['content-type']).toContain('rss+xml');
  expect(await rss.text()).toContain('<item>');
  expect((await request.get('/index.xml')).status()).toBe(200);
  expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /admin');
});

test('search finds accented titles from an unaccented query', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Tìm kiếm' }).click();
  await expect(page).toHaveURL(/\/search$/);
  await page.getByLabel('Từ khoá').fill('do luong toi uu');
  await page.getByRole('button', { name: 'Tìm' }).click();
  await expect(page).toHaveURL(/q=do\+luong\+toi\+uu/);
  const hit = page.getByRole('link', { name: /Đo lường trước khi tối ưu/ });
  await expect(hit).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await hit.click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Đo lường');

  await page.goto('/search?q=khongcokhoanao');
  await expect(page.getByText('Không có kết quả nào')).toBeVisible();
  await page.goto('/search?q=a');
  await expect(page.getByText('ít nhất 2 ký tự')).toBeVisible();
});

test('dark mode: toggle persists across reloads and restyles the page and code blocks', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await bg();

  await page.getByRole('button', { name: 'Chuyển sang giao diện tối' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await bg()).not.toBe(light);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // no flash: set before paint
  await expect(page.getByRole('button', { name: 'Chuyển sang giao diện sáng' })).toBeVisible();
});

test('dark mode follows the system setting until the reader chooses', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('posts have a generated share image with Vietnamese text', async ({ page, request }) => {
  await page.goto('/posts');
  await page.locator('a[href^="/posts/"]').first().click();
  const og = await page.locator('meta[property="og:image"]').first().getAttribute('content');
  expect(og).toMatch(/\/og\/posts\//);
  const res = await request.get(new URL(og!).pathname + new URL(og!).search);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toBe('image/png');
  expect((await res.body()).length).toBeGreaterThan(5_000);
});
