import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'

const CI_TEST_GLOB = path.resolve(import.meta.dirname, './ci/**/*.test.ts').replaceAll('\\', '/')

const DEV_WATCH_EXCLUDE = [
  './ci/hmr-*.test.ts',
  './ci/auto-import-vue-sfc.test.ts',
  './ci/style-import-vue.test.ts',
  './ci/wevu-runtime.hmr.test.ts',
].map(testPath => path.resolve(import.meta.dirname, testPath).replaceAll('\\', '/'))

export default defineConfig({
  test: {
    include: [CI_TEST_GLOB],
    exclude: DEV_WATCH_EXCLUDE,
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
