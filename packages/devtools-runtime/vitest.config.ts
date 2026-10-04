import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

export default defineProject({
  test: {
    include: [path.resolve(import.meta.dirname, 'test/**/*.test.ts').replaceAll('\\', '/')],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages/devtools-runtime'),
  },
})
