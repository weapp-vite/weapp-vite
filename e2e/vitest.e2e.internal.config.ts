import path from 'node:path'
import { defineConfig } from 'vitest/config'

function toPosixPath(filePath: string) {
  return filePath.replaceAll('\\', '/')
}

export default defineConfig({
  test: {
    // 内部测试通过 mock 验证 IDE 协议与所有权，不加载真实 IDE runtime suite。
    globalSetup: [path.resolve(import.meta.dirname, 'vitest.e2e.machine-lease.global-setup.ts')],
    taskTitleValueFormatTruncate: Number.POSITIVE_INFINITY,
    include: [
      toPosixPath(path.resolve(import.meta.dirname, './ide/runtimeErrors.test.ts')),
      toPosixPath(path.resolve(import.meta.dirname, './scripts/**/*.test.ts')),
      toPosixPath(path.resolve(import.meta.dirname, './utils/**/*.test.ts')),
    ],
    globals: true,
    environment: 'node',
  },
})
