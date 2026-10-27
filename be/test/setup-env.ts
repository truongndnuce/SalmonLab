// Runs in every e2e worker before app modules load. Points the app at the throwaway test database;
// process.env wins over be/.env in @nestjs/config, so the dev database is never touched.
export const TEST_DB = 'salmon_test';

export function testDatabaseUrl(): string {
  const base =
    process.env.E2E_DATABASE_URL_BASE ??
    'postgresql://salmon:salmon@localhost:5432';
  return `${base}/${TEST_DB}`;
}

process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_ACCESS_SECRET = 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';
process.env.REVALIDATE_SECRET = 'e2e-revalidate-secret';
process.env.WEB_BASE_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
// Separate buckets so e2e uploads never mix with dev media.
process.env.R2_BUCKET_MEDIA = 'blog-media-test';
process.env.R2_BUCKET_WIDGETS = 'blog-widgets-test';
process.env.R2_PUBLIC_MEDIA_URL = 'http://localhost:9000/blog-media-test';
process.env.R2_PUBLIC_WIDGETS_URL = 'http://localhost:9000/blog-widgets-test';
