import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage.ts'

const packageDir = import.meta.dirname

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(packageDir, './src'),
      },
      {
        find: '@weapp-core/shared',
        replacement: path.resolve(packageDir, '../../@weapp-core/shared/src/index.ts'),
      },
      {
        find: '@weapp-core/shared/node',
        replacement: path.resolve(packageDir, '../../@weapp-core/shared/src/node.ts'),
      },
      {
        find: '@weapp-core/shared/fs',
        replacement: path.resolve(packageDir, '../../@weapp-core/shared/src/fs/index.ts'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: createProjectCoverage('packages-runtime/weapi', {
      clean: false,
      exclude: [
        '**/dist/**',
      ],
    }),
  },
})
