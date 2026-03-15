import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      {
        find: '@weapp-vite/ast',
        replacement: path.resolve(__dirname, '../ast/src/index.ts'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: {
      exclude: [
        '**/dist/**',
      ],
    },
  },
})
