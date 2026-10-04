import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: [path.resolve(import.meta.dirname, '../../vitest.e2e.machine.global-setup.ts')],
    environment: 'node',
    include: [fileURLToPath(new URL('../runtimeBench*.test.ts', import.meta.url))],
    maxWorkers: 1,
  },
})
