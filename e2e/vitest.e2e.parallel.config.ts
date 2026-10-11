import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import { excludedE2ETestPatterns } from '../scripts/e2eProjectScope.ts'

export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, ...excludedE2ETestPatterns()],
    // 真实 IDE 只能通过 run-e2e-suite 的任务级串行入口运行；此配置仅保留 CI 用例。
    include: [path.resolve(import.meta.dirname, './ci/**/*.test.ts')],
    testTimeout: 36_000_000,
    globals: true,
    pool: 'threads',
    maxWorkers: 1,
    fileParallelism: false,
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
  },
})
