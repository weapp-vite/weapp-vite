import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

const __dirname = import.meta.dirname

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('apps/vite-native-ts'),
  },
})
