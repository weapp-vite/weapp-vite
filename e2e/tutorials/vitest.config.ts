import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: [path.resolve(import.meta.dirname, '../vitest.e2e.machine-lease.global-setup.ts')],
    include: [path.resolve(import.meta.dirname, './*.test.ts')],
    globals: true,
  },
})
