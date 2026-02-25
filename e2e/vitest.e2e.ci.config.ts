import path from 'node:path'
import { defineConfig } from 'vitest/config'

const CI_TEST_GLOB = path.resolve(import.meta.dirname, './ci/**/*.test.ts').replaceAll('\\', '/')

export default defineConfig({
  test: {
    include: [CI_TEST_GLOB],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
