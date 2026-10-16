import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = path.dirname(fileURLToPath(import.meta.url))

export default defineProject({
  root: packageDir,
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'test/**/*.test.ts',
    ],
    coverage: createProjectCoverage('packages-runtime/web-apis', {
      all: true,
      exclude: [
        '**/dist/**',
        '**/*.test.ts',
      ],
      include: ['src/**/*.ts'],
    }),
  },
})
