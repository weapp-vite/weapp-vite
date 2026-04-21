import path from 'node:path'
import { defineConfig } from 'vitest/config'

const E2E_UTIL_TEST_GLOB = path.resolve(import.meta.dirname, './utils/**/*.test.ts').replaceAll('\\', '/')

export default defineConfig({
  test: {
    include: [E2E_UTIL_TEST_GLOB],
    testTimeout: 60_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
