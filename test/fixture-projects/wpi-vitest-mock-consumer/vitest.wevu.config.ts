import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  test: {
    include: ['src/wevu.test.ts'],
    setupFiles: ['wevu/api/vitest/setup'],
  },
})
