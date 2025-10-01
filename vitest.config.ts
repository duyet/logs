import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      all: true,
      include: ['src/**/*.ts', 'functions/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types/**'],
      lines: 100,
      functions: 100,
      branches: 100,
      statements: 100,
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
