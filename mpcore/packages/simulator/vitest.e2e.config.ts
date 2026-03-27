import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, './test/browser.e2e.test.ts')],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: true,
    fileParallelism: false,
    pool: 'threads',
  },
})
