import path from 'node:path'
import { defineConfig } from 'vitest/config'

const RETAIL_PARITY_TEST_PATH = path.resolve(
  import.meta.dirname,
  './ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts',
)

export default defineConfig({
  test: {
    include: [
      path.resolve(import.meta.dirname, './ci/**/*.test.ts'),
      path.resolve(import.meta.dirname, './ide/**/*.test.ts'),
    ],
    exclude: [RETAIL_PARITY_TEST_PATH],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
