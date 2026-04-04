import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60000,
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
  },
});
