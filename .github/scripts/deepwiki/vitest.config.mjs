import { defineConfig } from 'vitest/config'

export default defineConfig({
  oxc: { tsconfig: false },
  test: {
    include: ['scripts/refresh-deepwiki*.test.ts', 'scripts/refresh-deepwiki/**/*.test.ts'],
  },
})
