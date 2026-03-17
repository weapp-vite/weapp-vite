import { defineConfig } from 'vitest/config'
import { HMR_GUARD_ALL_TESTS } from './scripts/hmr-guard-manifest'
import { resolveE2EMaxWorkers } from './utils/max-workers'

export default defineConfig({
  test: {
    include: HMR_GUARD_ALL_TESTS,
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
