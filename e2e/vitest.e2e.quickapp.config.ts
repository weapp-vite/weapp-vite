import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile'

const QUICKAPP_TEST_GLOB = path.resolve(import.meta.dirname, './quickapp/**/*.test.ts').replaceAll('\\', '/')

export default defineConfig({
  test: {
    include: resolveVitestIncludePatterns(import.meta.dirname, [QUICKAPP_TEST_GLOB]),
    testTimeout: 600_000,
    hookTimeout: 600_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
