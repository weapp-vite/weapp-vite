import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import { excludedE2ETestPatterns } from '../scripts/e2eProjectScope.ts'
import { resolveE2EMaxWorkers } from './utils/max-workers.ts'
import { resolveVitestIncludePatterns } from './utils/vitestTargetFile.ts'

const CI_TEST_GLOB = path.resolve(import.meta.dirname, './ci/**/*.test.ts').replaceAll('\\', '/')

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ...excludedE2ETestPatterns()],
    include: resolveVitestIncludePatterns(import.meta.dirname, [CI_TEST_GLOB]),
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
  },
})
