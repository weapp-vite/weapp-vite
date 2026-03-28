import path from 'node:path'
import { defineProject } from 'vitest/config'

export default defineProject({
  cacheDir: path.resolve(__dirname, './.vite'),
  test: {
    globals: true,
    coverage: {
      clean: false,
      exclude: [
        '**/dist/**',
      ],
    },
  },
})
