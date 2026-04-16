import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile'

const CI_TEST_GLOB = path.resolve(import.meta.dirname, './ci/**/*.test.ts').replaceAll('\\', '/')

export default defineConfig({
  test: {
    include: resolveVitestIncludePatterns(import.meta.dirname, [CI_TEST_GLOB]),
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
