import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
    include: ['cli', 'ipc'].map(name => path.resolve(import.meta.dirname, `bun/${name}.test.ts`)),
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 150_000,
  },
})
