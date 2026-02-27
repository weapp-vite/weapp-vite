import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, './web-runtime/web-demo.test.ts')],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
