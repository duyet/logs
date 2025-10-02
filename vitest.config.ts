import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/types/**',
        'functions/**', // Cloudflare Pages Functions require runtime to test
      ],
      thresholds: {
        lines: 99,
        functions: 100,
        branches: 95,
        statements: 99,
      },
    },
  },
});
