import path from 'node:path'
import { defineProject } from 'vitest/config'
import { createProjectCoverage } from '../../vitest.coverage'

export default defineProject({
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    alias: [
      {
        find: '@/',
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
      {
        find: '@wevu/compiler',
        replacement: path.resolve(__dirname, '../wevu-compiler/src/index.ts'),
      },
      {
        find: 'weapp-vite/auto-routes',
        replacement: path.resolve(__dirname, './src/auto-routes.ts'),
      },
    ],
    fileParallelism: false,
    globals: true,
    hookTimeout: 60_000,
    testTimeout: 120_000,
    // @ts-ignore
    coverage: createProjectCoverage('packages/weapp-vite', {
      enabled: true,
      all: false,
      clean: false,
      exclude: [
        '**/dist/**',
      ],
    }),
  },
})
