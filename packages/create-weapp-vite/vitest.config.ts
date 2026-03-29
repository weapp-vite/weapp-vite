import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    fileParallelism: false,
    globals: true,
    testTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
    coverage: createProjectCoverage('packages/create-weapp-vite'),
  },
})
