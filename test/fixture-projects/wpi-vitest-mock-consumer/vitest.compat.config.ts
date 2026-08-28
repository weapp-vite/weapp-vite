import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ['src/compat.test.ts'],
    setupFiles: ['@wevu/api/vitest/setup'],
  },
})
