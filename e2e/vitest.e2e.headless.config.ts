import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile'

export default defineConfig({
  test: {
    include: resolveVitestIncludePatterns(import.meta.dirname, [
      path.resolve(import.meta.dirname, './ide/**/*.test.ts'),
    ]),
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
