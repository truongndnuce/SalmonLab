import { defineConfig } from '@playwright/test';

// Smoke tests run against an already-running stack (API + `next start`), seeded with `pnpm --filter @salmon/be db:seed`.
export default defineConfig({
  testDir: './e2e',
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
