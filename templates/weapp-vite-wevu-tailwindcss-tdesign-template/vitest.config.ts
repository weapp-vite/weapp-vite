import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  oxc: { tsconfig: false },
  test: {
    include: ['test/**/*.test.ts'],
  },
})
