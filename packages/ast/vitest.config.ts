import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  cacheDir: path.resolve(__dirname, './.vite'),
  test: {
    globals: true,
    testTimeout: 60_000,
    coverage: {
      exclude: [
        '**/dist/**',
      ],
    },
  },
})
