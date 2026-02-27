import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'

const DEVTOOLS_GLOBAL_SETUP = path.resolve(import.meta.dirname, './vitest.e2e.ide.global-setup.ts')

export default defineConfig({
  test: {
    include: [
      path.resolve(
        import.meta.dirname,
        './ide/template-weapp-vite-wevu-tailwindcss-tdesign-retail-template.test.ts',
      ),
    ],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
    globalSetup: [DEVTOOLS_GLOBAL_SETUP],
  },
})
