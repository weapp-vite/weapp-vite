import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ['src/core.test.ts'],
    setupFiles: ['@weapp-core/api/vitest/setup'],
  },
})
