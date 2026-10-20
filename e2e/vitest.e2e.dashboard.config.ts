import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { createE2ESourceTransform } from './utils/sourceTransform.ts'

export default defineConfig({
  oxc: { exclude: /.*/ },
  plugins: [createE2ESourceTransform()],
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
