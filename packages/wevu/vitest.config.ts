import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  cacheDir: path.resolve(__dirname, './.vite'),
  test: {
    alias: [
      {
        find: '@',
        replacement: path.resolve(__dirname, './src'),
      },
    ],
    globals: true,
    testTimeout: 60_000,
    coverage: {
      reporter: ['text', 'lcov'],
      exclude: [
        'src/index.ts', // pure export barrel, exclude from coverage
      ],
    },
  },
})
