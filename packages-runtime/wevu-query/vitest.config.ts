import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@wevu/query',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
})
