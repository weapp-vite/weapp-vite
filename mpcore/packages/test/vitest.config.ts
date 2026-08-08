import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../../vitest.coverage.ts'

export default defineProject({
  test: {
    globals: true,
    coverage: createProjectCoverage('mpcore/packages/test', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts',
        '**/dist/**',
      ],
    }),
  },
})
