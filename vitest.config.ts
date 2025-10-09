import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Explicitly include only our test files
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.js',
    ],
    // Exclude Playwright tests and node_modules
    exclude: [
      'node_modules/**',
      'web/node_modules/**', // Exclude web app node_modules
      'dist/**',
      'tests/e2e/test-web-deployment.spec.ts', // Playwright E2E test
      'tests/playwright.config.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'web/node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.spec.ts',
        'src/types/',
        'tests/e2e/test-web-deployment.spec.ts',
      ],
    },
  },
});
