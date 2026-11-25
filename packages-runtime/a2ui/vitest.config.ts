import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: '@wevu/a2ui',
    include: ['src/**/*.test.ts'],
    globals: true,
  },
})
