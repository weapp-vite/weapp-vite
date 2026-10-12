import { defineConfig } from 'vitest/config'

export default defineConfig({
  tsconfig: './tsconfig.base.json',
  test: {
    environment: 'node',
    include: ['.github/scripts/deepwiki/browser.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 30_000,
  },
})
