import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, './utils/**/*.test.ts')],
    globals: true,
    pool: 'threads',
    fileParallelism: false,
    coverage: {
      enabled: false,
    },
  },
})
