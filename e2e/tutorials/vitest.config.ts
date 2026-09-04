import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, './contracts.test.ts')],
    globals: true,
  },
})
