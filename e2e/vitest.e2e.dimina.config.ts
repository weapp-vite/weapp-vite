import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile.ts'

export default defineConfig({
  test: {
    include: resolveVitestIncludePatterns(import.meta.dirname, [path.resolve(import.meta.dirname, 'dimina/*.test.ts')]),
    testTimeout: 120_000,
    hookTimeout: 240_000,
    maxWorkers: 1,
    fileParallelism: false,
  },
})
