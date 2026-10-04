import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: {
    tsconfig: false,
  },
  test: {
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine.global-setup.ts')],
    include: [path.resolve(import.meta.dirname, './web-runtime/dashboard-devframe.test.ts')],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
