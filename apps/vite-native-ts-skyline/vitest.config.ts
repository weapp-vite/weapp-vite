import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(packageDir, './'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('apps/vite-native-ts-skyline'),
  },
})
