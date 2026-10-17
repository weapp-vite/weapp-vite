import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/refresh-deepwiki*.test.ts'],
  },
})
