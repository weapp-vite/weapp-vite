import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../../vitest.coverage.ts'

export default defineProject({
  test: {
    globals: true,
    coverage: createProjectCoverage('mpcore/packages/weapp-vite', {
      clean: false,
      reporter: ['text', 'lcov'],
      exclude: [
        '**/dist/**',
      ],
    }),
  },
})
