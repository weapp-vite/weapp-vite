import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  cacheDir: path.resolve(packageDir, './.vite'),
  test: {
    globals: true,
    coverage: createProjectCoverage('packages/dashboard', {
      clean: false,
      exclude: [
        '**/dist/**',
      ],
    }),
  },
})
