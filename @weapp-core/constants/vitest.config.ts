import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineConfig({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    forceRerunTriggers: ['**/vitest.config.*/**', '**/vite.config.*/**'],
    coverage: createProjectCoverage('@weapp-core/constants', {
      clean: false,
      provider: 'v8',
      all: true,
      include: ['src/**/*.ts'],
      thresholds: {
        lines: 100,
        statements: 100,
        branches: 100,
        functions: 100,
      },
    }),
  },
})
