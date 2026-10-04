import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  test: {
    alias: [
      {
        find: '@weapp-vite/miniprogram-automator/operation',
        replacement: path.resolve(packageDir, '../miniprogram-automator/src/operation/index.ts'),
      },
      {
        find: '@',
        replacement: path.resolve(packageDir, './src'),
      },
    ],
    globals: true,
    testTimeout: 30_000,
    coverage: createProjectCoverage('packages/weapp-ide-cli'),
  },
})
