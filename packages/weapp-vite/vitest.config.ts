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
    ],
    globals: true,
    testTimeout: 60_000,
    // @ts-ignore
    coverage: {
      enabled: true,
      all: false,
    },
    setupFiles: [
      './vitest.setup.ts',
    ],
  },
})
