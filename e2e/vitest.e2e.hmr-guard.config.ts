import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { HMR_GUARD_ALL_TESTS } from './scripts/hmr-guard-manifest.ts'
import { resolveE2EMaxWorkers } from './utils/max-workers.ts'

export default defineConfig({
  test: {
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine.global-setup.ts')],
    include: HMR_GUARD_ALL_TESTS,
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
