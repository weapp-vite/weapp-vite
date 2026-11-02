import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS } from './utils/devProcessCleanup/shutdown.ts'

const E2E_UTIL_TEST_GLOB = path.resolve(import.meta.dirname, './utils/**/*.test.ts').replaceAll('\\', '/')

export default defineConfig({
  test: {
    setupFiles: [path.resolve(import.meta.dirname, './vitest.e2e.dev-process.setup.ts')],
    hookTimeout: DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS,
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
    taskTitleValueFormatTruncate: Number.POSITIVE_INFINITY,
    include: [E2E_UTIL_TEST_GLOB],
    testTimeout: 60_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
