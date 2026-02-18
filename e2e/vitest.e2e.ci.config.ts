import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { DEVTOOLS_E2E_FILES } from './test-groups'

const DEVTOOLS_ABS_FILES = DEVTOOLS_E2E_FILES.map(file => path.resolve(import.meta.dirname, file))

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, './*.test.ts')],
    exclude: DEVTOOLS_ABS_FILES,
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
