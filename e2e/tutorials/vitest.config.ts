import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, './*.test.ts')],
    globals: true,
  },
})
