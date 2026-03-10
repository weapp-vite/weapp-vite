import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { ensureIdeWarningReportEnv } from './utils/ideWarningReport'
import { resolveE2EMaxWorkers } from './utils/max-workers'

const DEVTOOLS_GLOBAL_SETUP = path.resolve(import.meta.dirname, './vitest.e2e.ide.global-setup.ts')
const maxWorkers = resolveE2EMaxWorkers()

ensureIdeWarningReportEnv()

export default defineConfig({
  test: {
    include: [
      path.resolve(import.meta.dirname, './ci/**/*.test.ts'),
      path.resolve(import.meta.dirname, './ide/**/*.test.ts'),
    ],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers,
    fileParallelism: maxWorkers > 1,
    globalSetup: [DEVTOOLS_GLOBAL_SETUP],
  },
})
