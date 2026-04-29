import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineProject({
  test: {
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages/devtools-runtime'),
  },
})
