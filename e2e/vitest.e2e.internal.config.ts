import path from 'node:path'
import { defineConfig } from 'vitest/config'
import { localReporters, localTestPolicy } from '../scripts/verificationBenchmark/localReporterConfig.mjs'
import { DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS } from './utils/devProcessCleanup/shutdown.ts'

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

export default defineConfig({
  test: {
    setupFiles: [path.resolve(import.meta.dirname, './vitest.e2e.dev-process.setup.ts')],
    hookTimeout: DEV_PROCESS_CLEANUP_HOOK_TIMEOUT_MS,
    reporters: localReporters(),
    ...localTestPolicy(),
    // 内部测试通过 mock 验证 IDE 协议与所有权，不加载真实 IDE runtime suite。
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
    taskTitleValueFormatTruncate: Number.POSITIVE_INFINITY,
    // 真实 ESLint、CIM 和嵌套 runner 共用本机进程资源；保留各测试预算，按文件串行执行。
    maxWorkers: 1,
    fileParallelism: false,
    include: [
      toPosixPath(path.resolve(import.meta.dirname, './ide/runtimeErrors.test.ts')),
      toPosixPath(path.resolve(import.meta.dirname, './scripts/**/*.test.ts')),
      toPosixPath(path.resolve(import.meta.dirname, './utils/**/*.test.ts')),
    ],
    globals: true,
    environment: 'node',
  },
})
