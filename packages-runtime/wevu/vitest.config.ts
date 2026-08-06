import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  cacheDir: path.resolve(packageDir, './.vite'),
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(packageDir, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages-runtime/wevu', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts', // pure export barrel, exclude from coverage
        '**/dist/**',
      ],
    }),
  },
})
