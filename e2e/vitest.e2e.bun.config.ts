import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS } from './utils/devProcessCleanup/shutdown.ts'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile'

export default defineConfig({
  test: {
    setupFiles: [path.resolve(import.meta.dirname, './vitest.e2e.dev-process.setup.ts')],
    hookTimeout: DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS,
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
    include: resolveVitestIncludePatterns(import.meta.dirname, ['cli', 'ipc'].map(name => path.resolve(import.meta.dirname, `bun/${name}.test.ts`))),
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 150_000,
  },
})
