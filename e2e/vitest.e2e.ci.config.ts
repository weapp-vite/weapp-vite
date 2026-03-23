import path from 'node:path'
import { env } from 'node:process'
import { defineConfig } from 'vitest/config'
import { resolveE2EMaxWorkers } from './utils/max-workers'

const CI_TEST_GLOB = path.resolve(import.meta.dirname, './ci/**/*.test.ts').replaceAll('\\', '/')
const WEVU_RUNTIME_PLATFORMS_TEST = path.resolve(import.meta.dirname, './ci/wevu-runtime.platforms.test.ts').replaceAll('\\', '/')
const E2E_PLATFORM = env.E2E_PLATFORM

export default defineConfig({
  test: {
    include: [CI_TEST_GLOB],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: resolveE2EMaxWorkers(),
    fileParallelism: false,
    resolveSnapshotPath(testPath, snapExtension) {
      const normalizedTestPath = testPath.replaceAll('\\', '/')

      if (!E2E_PLATFORM || normalizedTestPath !== WEVU_RUNTIME_PLATFORMS_TEST) {
        return path.join(path.dirname(testPath), '__snapshots__', `${path.basename(testPath)}${snapExtension}`)
      }

      return path.join(
        path.dirname(testPath),
        '__snapshots__',
        `${path.basename(testPath)}.${E2E_PLATFORM}${snapExtension}`,
      )
    },
  },
})
