import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      path.resolve(import.meta.dirname, './platforms/verification.test.ts').replaceAll('\\', '/'),
      path.resolve(import.meta.dirname, './scripts/platform-runtime-doctor.test.ts').replaceAll('\\', '/'),
      path.resolve(import.meta.dirname, './ci/platform-build.test.ts').replaceAll('\\', '/'),
      path.resolve(import.meta.dirname, './ci/template-multi-platform.build.test.ts').replaceAll('\\', '/'),
      path.resolve(import.meta.dirname, './ci/template-multi-platform-sfc.build.test.ts').replaceAll('\\', '/'),
      path.resolve(import.meta.dirname, './ci/wevu-runtime.platforms.test.ts').replaceAll('\\', '/'),
    ],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
  },
})
