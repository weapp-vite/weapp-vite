import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    setupFiles: ['./vitest.setup.ts'],
    include: ['test/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // https://vitest.dev/config/#forcereruntriggers
    forceRerunTriggers: ['**/vitest.config.*/**', '**/vite.config.*/**'],
  },
})
