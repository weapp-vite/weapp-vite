import { defineConfig } from 'vitest/config'
import { createProjectCoverage } from '../../../vitest.coverage'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: createProjectCoverage('mpcore/packages/core'),
  },
})
