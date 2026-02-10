import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  define: {
    'process.env.__TEST__': JSON.stringify(true),
  },
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
      {
        find: 'weapp-vite/auto-routes',
        replacement: path.resolve(__dirname, './src/auto-routes.ts'),
      },
    ],
    globals: true,
    hookTimeout: 60_000,
    testTimeout: 120_000,
    // @ts-ignore
    coverage: {
      enabled: true,
      all: false,
    },
  },
})
