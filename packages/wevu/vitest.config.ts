import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineProject({
  cacheDir: path.resolve(__dirname, './.vite'),
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages/wevu', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts', // pure export barrel, exclude from coverage
        '**/dist/**',
      ],
    }),
  },
})
