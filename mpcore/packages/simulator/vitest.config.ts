import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../../vitest.coverage'

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
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('mpcore/packages/simulator', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts',
        '**/dist/**',
      ],
    }),
  },
})
