import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: [fileURLToPath(new URL('./validation.test.ts', import.meta.url))],
  },
})
