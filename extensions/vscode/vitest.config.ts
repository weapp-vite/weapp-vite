import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['extension/**/*.test.ts'],
    environment: 'node',
    globals: false,
  },
})
