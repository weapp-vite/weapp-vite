import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { localReporters, localTestPolicy } from '../../scripts/verificationBenchmark/localReporterConfig.mjs'
import { nativeWatchContractTests } from './vitest/partition.ts'

const packageDir = import.meta.dirname

export default defineConfig({
  root: packageDir,
  oxc: { tsconfig: false },
  define: { 'process.env.__TEST__': JSON.stringify(true) },
  test: {
    name: 'weapp-vite-watch-native',
    reporters: localReporters(),
    ...localTestPolicy(),
    environment: 'node',
    dir: packageDir,
    // 路径由分区清单统一维护，仅发现 scripts/watcherComparison 中的真实原生实验契约。
    include: [...nativeWatchContractTests],
    // 直接使用本配置也取得同一机器租约，不取得真实 IDE journal 或清理权。
    globalSetup: [path.resolve(packageDir, '../../e2e/vitest.e2e.machine-lease.global-setup.ts')],
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    sequence: { concurrent: false, shuffle: false },
    allowOnly: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
})
