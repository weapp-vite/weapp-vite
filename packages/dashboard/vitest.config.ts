import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineProject({
  cacheDir: path.resolve(__dirname, './.vite'),
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
