import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.ts'],
    // The first Shiki call loads the highlighter, which can exceed 5s on a busy machine (e.g. parallel turbo tasks).
    testTimeout: 30_000,
  },
});
