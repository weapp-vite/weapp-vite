import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, 'dimina/*.test.ts')],
    testTimeout: 120_000,
    hookTimeout: 240_000,
    maxWorkers: 1,
    fileParallelism: false,
  },
})
