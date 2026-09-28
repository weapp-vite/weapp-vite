import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@wevu/json-render',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
})
