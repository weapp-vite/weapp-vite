import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineConfig({
  cacheDir: path.resolve(packageDir, './.vite'),
  test: {
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages/ast', {
      clean: false,
      exclude: [
        '**/dist/**',
      ],
    }),
  },
})
