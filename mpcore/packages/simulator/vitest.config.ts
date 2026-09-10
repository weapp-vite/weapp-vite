import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  test: {
    exclude: [
      'e2e/**',
      'test-d/**',
      '**/dist/**',
    ],
    alias: [
      {
        find: '@',
        replacement: path.resolve(packageDir, './src'),
      },
    ],
    globals: true,
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
    testTimeout: 60_000,
    coverage: createProjectCoverage('mpcore/packages/simulator', {
      enabled: false,
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts',
        '**/dist/**',
      ],
    }),
  },
})
