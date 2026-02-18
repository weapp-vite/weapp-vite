import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      path.resolve(import.meta.dirname, './ci/**/*.test.ts'),
      path.resolve(import.meta.dirname, './ide/**/*.test.ts'),
    ],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
