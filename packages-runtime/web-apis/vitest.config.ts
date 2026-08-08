import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = path.dirname(fileURLToPath(import.meta.url))

export default defineProject({
  test: {
    globals: true,
    environment: 'node',
    include: [
      path.join(packageDir, 'src/**/*.test.ts'),
      path.join(packageDir, 'test/**/*.test.ts'),
    ],
    coverage: createProjectCoverage('packages-runtime/web-apis', {
      all: true,
      exclude: [
        '**/dist/**',
        '**/*.test.ts',
      ],
      include: [path.join(packageDir, 'src/**/*.ts')],
    }),
  },
})
