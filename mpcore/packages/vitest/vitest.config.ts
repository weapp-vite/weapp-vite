import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../../vitest.coverage'

export default defineProject({
  test: {
    globals: true,
    coverage: createProjectCoverage('mpcore/packages/vitest', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        'src/setup.ts',
        '**/dist/**',
      ],
    }),
  },
})
